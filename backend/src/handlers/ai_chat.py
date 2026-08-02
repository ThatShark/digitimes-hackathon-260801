"""AI Chat Lambda handler.

Implements POST /ai_chat per backend/api.yaml operationId aiChat.

Uses Bedrock Converse **Tool Use**: the model itself decides whether it
needs live data (price / Fear&Greed index / fund-flow analysis / technical
indicators) before answering, and — separately — whether it has enough
basis to propose a structured trade suggestion (see src/services/ai_tools.py
for the 5 tool definitions). This replaces the previous design where the
backend unconditionally fetched price + Fear&Greed data on every request
and tried to regex/keyword-match a trade suggestion out of the AI's
free-form text (which could only ever produce a hardcoded default amount,
since the old system prompt told the model not to mention amounts at all).

Flow per request (see _run_tool_use_loop()):
    1. Call Bedrock with the tools offered (fewer if no `currency` in the
       request — see ai_tools.build_tool_config()).
    2. If stopReason == "tool_use": execute the requested tool(s), feed the
       results back, and call Bedrock again. Repeated up to
       _MAX_TOOL_ROUNDS times to bound Lambda execution time / token spend
       in case the model keeps chaining tool calls — a thorough analysis
       can legitimately call all 4 data tools once each before proposing a
       trade, so the cap must leave headroom beyond that (see
       _MAX_TOOL_ROUNDS's comment).
    3. Once stopReason != "tool_use" (or the round cap is hit), return the
       assistant's text as `message`. If `propose_trade` was called at any
       point in the loop, its (last) input becomes `investment_suggestion`.

Request body (AiChatRequest):
{
  "message": "我想買 BTC",
  "currency": "BTC"          // optional — provides coin context; also
                              // gates which tools are offered and scopes
                              // any trade suggestion to this currency
}

Success response 200 (AiChatResponse):
{
  "status": "ready",
  "message": "根據目前恐懼貪婪指數...",
  "investment_suggestion": {   // null if the AI didn't call propose_trade
    "currency": "BTC",
    "action": "buy",
    "amount": 5000              // TWD; sourced from the tool's amount_twd field
  }
}

Error responses:
  400 — missing or empty message
  503 — Bedrock unavailable (each individual Converse call already retries
        3 times internally — see bedrock.py's RETRY_ATTEMPTS — this is the
        final failure after those retries are exhausted)
"""

import json
import os
import time as _time

from src.services.ai_tools import (
    TOOL_PROPOSE_TRADE,
    build_tool_config,
    execute_tool,
)
from src.services.bedrock import BedrockChatClient, BedrockError, _load_system_prompt
from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import TradeDataError, compute_avg_trade_amount, parse_trades_csv

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"

# Upper bound on how many times the model may call tools before we force a
# final answer — protects against runaway tool-chaining eating Lambda
# execution time / token budget.
#
# IMPORTANT: The real guard against API Gateway's 29s timeout is the
# time-based deadline (25s) checked each round. This round cap is just a
# safety net in case time checks somehow fail. Set it high enough that
# normal multi-tool conversations (price + indicators + fear&greed +
# fund_flow + propose_trade) can complete, but low enough to prevent
# infinite loops.
_MAX_TOOL_ROUNDS = 6


def lambda_handler(event, context):
    """POST /ai_chat (also handles OPTIONS preflight for Function URL)"""
    # Handle CORS preflight for Lambda Function URL (no API Gateway to do it)
    http_method = (
        (event.get("requestContext", {}).get("http", {}).get("method"))
        or event.get("httpMethod")
        or ""
    ).upper()
    if http_method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    try:
        return _handle(event, context)
    except Exception as exc:
        print(f"[AI_CHAT] Unhandled exception: {type(exc).__name__}: {exc}")
        return _error(500, f"內部錯誤：{type(exc).__name__}: {exc}")


def _handle(event, context):
    """Inner handler — separated so the outer lambda_handler can catch all."""
    start_time = _time.time()

    # Detect if invoked via Lambda Function URL (no 29s API Gateway timeout)
    # vs API Gateway (hard 29s limit). Function URL events have
    # requestContext.http instead of requestContext.httpMethod.
    is_function_url = "http" in (event.get("requestContext") or {})

    timeout_ms = getattr(context, "get_remaining_time_in_millis", lambda: 120000)()
    lambda_deadline = start_time + (timeout_ms / 1000) - 5

    if is_function_url:
        # Function URL: no gateway timeout, use full Lambda timeout
        deadline = lambda_deadline
    else:
        # API Gateway: hard 29s integration timeout
        gateway_deadline = start_time + 25
        deadline = min(lambda_deadline, gateway_deadline)

    # ── Parse request body ────────────────────────────────────────────────────
    # Function URL may base64-encode the body
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        raw_body = base64.b64decode(raw_body).decode("utf-8")
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    message = (body.get("message") or "").strip()
    if not message:
        return _error(400, "message 不可為空")

    currency = (body.get("currency") or "").strip().upper() or None

    # ── Load user context for the system prompt (best-effort) ──────────────────
    user_id = _extract_user_id(event)
    personality_context = _load_personality_analysis(user_id)
    avg_trade_amount = _load_avg_trade_amount(user_id)
    quiz_context = _load_quiz_results(user_id)

    # ── Build Bedrock messages (with conversation history) ───────────────────
    before_messages = (body.get("before_messages") or [])[-3:]  # cap to last 3 turns to fit within model context limits

    messages = []
    for turn in before_messages:
        if isinstance(turn, dict):
            user_text = (turn.get("user") or "").strip()
            ai_text = (turn.get("ai") or "").strip()
            if user_text and ai_text:
                # Truncate long AI responses in history to keep context manageable
                # (full responses can be 2000+ chars each with tables/analysis)
                if len(ai_text) > 500:
                    ai_text = ai_text[:500] + "…（回覆已截斷）"
                messages.append({"role": "user", "content": [{"text": user_text}]})
                messages.append({"role": "assistant", "content": [{"text": ai_text}]})

    user_content = f"[目前查看幣種: {currency}] {message}" if currency else message
    messages.append({"role": "user", "content": [{"text": user_content}]})

    # ── Build system prompt ───────────────────────────────────────────────────
    system_prompt = _build_system_prompt(personality_context, avg_trade_amount, quiz_context)

    # ── Run the tool-use loop ─────────────────────────────────────────────────
    client = BedrockChatClient()
    tool_config = build_tool_config(currency)

    try:
        final_text, suggestion_input = _run_tool_use_loop(
            client, messages, system_prompt, tool_config, currency, deadline
        )
    except BedrockError as exc:
        error_msg = str(exc).lower()
        # If context is too large, retry with reduced history
        if "validation" in error_msg or "too long" in error_msg or "too many" in error_msg or "token" in error_msg:
            print(f"[AI_CHAT] Context too large, retrying with no history")
            # Strip all history, keep only the current user message
            messages = [messages[-1]]
            try:
                final_text, suggestion_input = _run_tool_use_loop(
                    client, messages, system_prompt, tool_config, currency, deadline
                )
            except BedrockError as exc2:
                print(f"[AI_CHAT] Still failing after dropping history: {exc2}")
                return _error(503, f"AI 服務暫時無法使用：{exc2}")
        else:
            print(f"[AI_CHAT] Bedrock error: {exc}")
            return _error(503, f"AI 服務暫時無法使用：{exc}")

    suggestion = None
    if suggestion_input is not None and currency:
        suggestion = {
            "currency": currency,
            "action": suggestion_input.get("action"),
            "amount": suggestion_input.get("amount_twd"),
        }

    # Guard against empty response (model only produced tool calls, no text)
    if not final_text:
        final_text = "已完成分析，但無法產生文字回覆。請再試一次。"

    return json_response(200, {
        "status": "ready",
        "message": final_text,
        "investment_suggestion": suggestion,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Tool-use loop
# ─────────────────────────────────────────────────────────────────────────────

def _run_tool_use_loop(
    client: BedrockChatClient,
    messages: list,
    system_prompt: str,
    tool_config: dict,
    currency: "str | None",
    deadline: float,
) -> "tuple[str, dict | None]":
    """Drive the multi-round Bedrock Tool Use conversation.

    Returns (final_text, propose_trade_input_or_none).

    Each individual Bedrock call already retries internally (3 attempts,
    see bedrock.py) and raises BedrockError if all attempts fail — that
    propagates up to lambda_handler, which turns it into a 503. This
    function only adds the *outer* loop over tool-use rounds, not
    per-call retries.
    """
    suggestion_input = None

    for _round in range(_MAX_TOOL_ROUNDS):
        # Check time budget before each Bedrock call
        if _time.time() >= deadline:
            print(f"[AI_CHAT] Approaching timeout at round {_round}, returning partial answer")
            return "分析時間較長，目前尚無法完成完整回覆，請稍後再試或簡化問題。", suggestion_input

        # If we're running low on time (less than 12s left), inject a user
        # message asking the model to answer NOW without calling more tools.
        time_left = deadline - _time.time()
        if time_left < 12 and _round > 0:
            messages.append({
                "role": "user",
                "content": [{"text": "[系統提示：時間即將到期，請根據目前已取得的資料直接回覆使用者，不要再呼叫任何工具。]"}]
            })

        response = client.converse_raw(messages, system_prompt=system_prompt, tool_config=tool_config)
        stop_reason = response.get("stopReason")
        assistant_content = response.get("output", {}).get("message", {}).get("content", [])

        if stop_reason != "tool_use":
            return BedrockChatClient._extract_text(response), suggestion_input

        # Echo the assistant's tool-use turn back into the conversation
        # (required by Converse API — the model's own content, including any
        # reasoningContent blocks, must be preserved verbatim).
        messages.append({"role": "assistant", "content": assistant_content})

        tool_result_blocks = []
        for block in assistant_content:
            tool_use = block.get("toolUse")
            if not tool_use:
                continue

            name = tool_use.get("name")
            tool_input = tool_use.get("input", {}) or {}

            # Check time budget before each tool execution
            if _time.time() >= deadline and name != TOOL_PROPOSE_TRADE:
                print(f"[AI_CHAT] Approaching timeout during tool execution, skipping {name}")
                result = {"error": "時間不足，跳過此工具查詢"}
            elif name == TOOL_PROPOSE_TRADE:
                # Not an external API call — the model's own structured
                # decision. Keep the LAST call if it's invoked more than
                # once across rounds (most up-to-date reasoning wins).
                suggestion_input = tool_input
                result = {"status": "acknowledged"}
            else:
                result = execute_tool(name, tool_input, currency)

            tool_result_blocks.append({
                "toolResult": {
                    "toolUseId": tool_use.get("toolUseId"),
                    "content": [{"json": result}],
                }
            })

        messages.append({"role": "user", "content": tool_result_blocks})

    # Exceeded _MAX_TOOL_ROUNDS without a final text answer.
    print(f"[AI_CHAT] Exceeded {_MAX_TOOL_ROUNDS} tool-use rounds without a final answer")

    # Try one last call with a forced instruction to answer
    try:
        messages.append({
            "role": "user",
            "content": [{"text": "[系統提示：已達工具呼叫上限，請根據目前已取得的所有資料，直接用文字回覆使用者的問題。]"}]
        })
        response = client.converse_raw(messages, system_prompt=system_prompt, tool_config=tool_config)
        text = BedrockChatClient._extract_text(response)
        if text:
            return text, suggestion_input
    except BedrockError:
        pass

    return "這個問題需要查詢的資料較多，AI 暫時無法在時間內完成完整分析，請稍後再試或換個方式提問。", suggestion_input


# ─────────────────────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────────────────────

def _build_system_prompt(personality_context: str, avg_trade_amount: "float | None", quiz_context: str = "") -> str:
    base_prompt = _load_system_prompt()

    if personality_context:
        personality_section = (
            f"## 這位用戶的投資人格分析\n{personality_context}\n\n"
            f"請根據以上用戶特質，調整你的回覆風格和建議方向。"
        )
    else:
        personality_section = (
            "## 用戶狀態\n"
            "這位用戶尚未完成投資人格分析。在適當的時機（例如用戶詢問個人化建議時），"
            "溫和地建議他：「建議你先完成投資人格問卷或上傳交易紀錄 CSV，"
            "這樣我可以根據你的投資風格提供更精準的建議喔！」\n"
            "但如果用戶只是問一般市場問題，不需要每次都提醒。"
        )

    if avg_trade_amount:
        amount_section = (
            f"## 用戶歷史交易金額參考\n"
            f"這位用戶過去每筆交易的平均金額約為 NT${avg_trade_amount:,.0f}。"
            f"當你使用 propose_trade 工具建議交易金額時，請以這個數字為基準，"
            f"依照當前市場狀況（例如恐懼貪婪指數的極端程度）適度調整，"
            f"不要建議遠超出此金額的數字，除非有充分理由並在 reason 中說明。"
        )
    else:
        amount_section = (
            "## 用戶歷史交易金額參考\n"
            "這位用戶沒有可參考的歷史交易金額紀錄。"
            "若要使用 propose_trade 工具建議交易金額，請採取保守金額（例如 NT$1,000~5,000 之間），"
            "並在 reason 中提醒用戶這只是保守建議，實際金額應依自身財務狀況調整。"
        )

    quiz_section = ""
    if quiz_context:
        quiz_section = f"\n\n## 用戶補充問卷分析結果\n{quiz_context}\n\n請參考以上資料，讓你的建議更貼合這位用戶的實際狀況。"

    return f"{base_prompt}\n\n{personality_section}\n\n{amount_section}{quiz_section}"


# ─────────────────────────────────────────────────────────────────────────────
# S3 context loaders (best-effort — return falsy on any failure)
# ─────────────────────────────────────────────────────────────────────────────

def _load_personality_analysis(user_id: "str | None") -> str:
    """Load the user's long personality analysis from S3. Returns '' on failure."""
    if not user_id:
        return ""
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if not bucket:
        return ""
    try:
        storage = S3StorageService(bucket_name=bucket)
        metrics_bytes = storage.get_trade_metrics(user_id)
        metrics = json.loads(metrics_bytes.decode("utf-8"))
        analysis = metrics.get("personality_analysis", "")
        # Truncate to avoid blowing up Bedrock's context limit
        if len(analysis) > 1500:
            analysis = analysis[:1500] + "…（分析已截斷）"
        return analysis
    except (S3StorageError, json.JSONDecodeError, UnicodeDecodeError):
        return ""


def _load_avg_trade_amount(user_id: "str | None") -> "float | None":
    """Load the user's CSV and compute their average TWD trade amount, so
    propose_trade's suggested amount can be scaled to the user's own
    habits (per product decision — see ai_tools.py's propose_trade
    description). Returns None on any failure (no CSV, corrupt CSV, no S3
    config) — the system prompt falls back to a conservative default."""
    if not user_id:
        return None
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if not bucket:
        return None
    try:
        storage = S3StorageService(bucket_name=bucket)
        csv_bytes = storage.get_trades_csv(user_id)
        trades = parse_trades_csv(csv_bytes)
        avg = compute_avg_trade_amount(trades)
        return avg if avg > 0 else None
    except (S3StorageError, TradeDataError):
        return None


def _load_quiz_results(user_id: "str | None") -> str:
    """Load all supplementary quiz results from S3 and format them as a
    human-readable context string for the system prompt.

    Returns '' if no quiz results are found or on any failure.
    """
    if not user_id:
        return ""
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if not bucket:
        return ""

    quiz_ids = ["investment-habits", "investment-experience", "investment-budget"]
    quiz_titles = {
        "investment-habits": "投資習慣",
        "investment-experience": "投資經驗",
        "investment-budget": "投資預算與目標",
    }

    sections = []
    storage = S3StorageService(bucket_name=bucket)
    for quiz_id in quiz_ids:
        try:
            result_bytes = storage.get_quiz_result(user_id, quiz_id)
            result = json.loads(result_bytes.decode("utf-8"))
            dims = result.get("dimensions", {})
            if not dims:
                continue
            title = quiz_titles.get(quiz_id, quiz_id)
            lines = [f"### {title}（整體平均: {result.get('overall_avg', 0)}/7）"]
            for dim_id, dim_data in dims.items():
                name = dim_data.get("name", dim_id)
                avg = dim_data.get("avg_score", 0)
                lines.append(f"- {name}: {avg}/7")
            sections.append("\n".join(lines))
        except (S3StorageError, json.JSONDecodeError, UnicodeDecodeError):
            continue

    return "\n\n".join(sections)


def _extract_user_id(event) -> "str | None":
    """Extract user_id from query params, path params, or authorizer."""
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("user_id")
    if user_id:
        return user_id
    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("user_id")
    if user_id:
        return user_id
    try:
        return event["requestContext"]["authorizer"]["claims"]["sub"]
    except (KeyError, TypeError):
        return None


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
