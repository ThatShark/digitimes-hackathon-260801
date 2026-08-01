"""AI Chat Lambda handler.

Implements POST /ai_chat per backend/api.yaml operationId aiChat.

Uses Bedrock Converse **Tool Use**: the model itself decides whether it
needs live data (price / Fear&Greed index / fund-flow analysis) before
answering, and — separately — whether it has enough basis to propose a
structured trade suggestion (see src/services/ai_tools.py for the 4 tool
definitions). This replaces the previous design where the backend
unconditionally fetched price + Fear&Greed data on every request and tried
to regex/keyword-match a trade suggestion out of the AI's free-form text
(which could only ever produce a hardcoded default amount, since the old
system prompt told the model not to mention amounts at all).

Flow per request (see _run_tool_use_loop()):
    1. Call Bedrock with the 4 tools offered (fewer if no `currency` in the
       request — see ai_tools.build_tool_config()).
    2. If stopReason == "tool_use": execute the requested tool(s), feed the
       results back, and call Bedrock again. Repeated up to
       _MAX_TOOL_ROUNDS times to bound Lambda execution time / token spend
       in case the model keeps chaining tool calls.
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
# execution time / token budget. If exceeded without a finished answer,
# the user gets a generic "couldn't complete" message rather than an
# indefinitely hanging request.
_MAX_TOOL_ROUNDS = 5


def lambda_handler(event, context):
    """POST /ai_chat"""
    # ── Parse request body ────────────────────────────────────────────────────
    try:
        body = json.loads(event.get("body") or "{}")
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

    # ── Build Bedrock messages (with conversation history) ───────────────────
    before_messages = (body.get("before_messages") or [])[-20:]  # cap history length

    messages = []
    for turn in before_messages:
        if isinstance(turn, dict):
            user_text = (turn.get("user") or "").strip()
            ai_text = (turn.get("ai") or "").strip()
            if user_text and ai_text:
                messages.append({"role": "user", "content": [{"text": user_text}]})
                messages.append({"role": "assistant", "content": [{"text": ai_text}]})

    user_content = f"[目前查看幣種: {currency}] {message}" if currency else message
    messages.append({"role": "user", "content": [{"text": user_content}]})

    # ── Build system prompt ───────────────────────────────────────────────────
    system_prompt = _build_system_prompt(personality_context, avg_trade_amount)

    # ── Run the tool-use loop ─────────────────────────────────────────────────
    client = BedrockChatClient()
    tool_config = build_tool_config(currency)

    try:
        final_text, suggestion_input = _run_tool_use_loop(
            client, messages, system_prompt, tool_config, currency
        )
    except BedrockError as exc:
        print(f"[AI_CHAT] Bedrock error: {exc}")
        return _error(503, "AI 服務暫時無法使用，請稍後再試")

    suggestion = None
    if suggestion_input is not None and currency:
        suggestion = {
            "currency": currency,
            "action": suggestion_input.get("action"),
            "amount": suggestion_input.get("amount_twd"),
        }

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

            if name == TOOL_PROPOSE_TRADE:
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
    return "這個問題需要查詢的資料較多，AI 暫時無法在時間內完成完整分析，請稍後再試或換個方式提問。", suggestion_input


# ─────────────────────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────────────────────

def _build_system_prompt(personality_context: str, avg_trade_amount: "float | None") -> str:
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

    return f"{base_prompt}\n\n{personality_section}\n\n{amount_section}"


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
        return metrics.get("personality_analysis", "")
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
