"""AI Chat Lambda handler.

Implements POST /ai_chat per backend/api.yaml operationId aiChat.

Request body (AiChatRequest):
{
  "message": "我想買 BTC",
  "currency": "BTC"          // optional — provides coin context
}

Success response 200 (AiChatResponse):
{
  "status": "ready",
  "message": "根據目前恐懼貪婪指數...",
  "investment_suggestion": {   // null if no suggestion
    "currency": "BTC",
    "action": "buy",
    "amount": 5000
  }
}

Error responses:
  400 — missing or empty message
  503 — Bedrock API unavailable after retries
"""

import json
import os
import re

from src.services.bedrock import BedrockChatClient, BedrockError
from src.services.s3_storage import S3StorageService
from src.utils.http import json_response

# Keywords to detect trade suggestions in AI response
_BUY_KEYWORDS = ["建議買入", "建議買", "推薦買入", "suggest buy", "建議加倉"]
_SELL_KEYWORDS = ["建議賣出", "建議賣", "建議出場", "suggest sell", "建議停損"]

# Regex to extract amount (e.g. "5000", "NT$5,000", "5000 TWD")
_AMOUNT_PATTERN = re.compile(r"(?:NT\$?\s?|TWD\s?)?(\d[\d,]*)")

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


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

    currency = (body.get("currency") or "").strip() or None

    # ── Load user personality analysis for system prompt context ───────────────
    user_id = _extract_user_id(event)
    personality_context = _load_personality_analysis(user_id)

    # ── Build Bedrock messages ────────────────────────────────────────────────
    user_content = message
    if currency:
        user_content = f"[目前查看幣種: {currency}] {message}"

    messages = [
        {"role": "user", "content": [{"text": user_content}]},
    ]

    # ── Build enhanced system prompt with personality context ──────────────────
    enhanced_system_prompt = None
    if personality_context:
        enhanced_system_prompt = (
            f"## 這位用戶的投資人格分析\n"
            f"{personality_context}\n\n"
            f"請根據以上用戶特質，調整你的回覆風格和建議方向。"
        )
    else:
        enhanced_system_prompt = (
            "## 用戶狀態\n"
            "這位用戶尚未完成投資人格分析。在適當的時機（例如用戶詢問個人化建議時），"
            "溫和地建議他：「建議你先完成投資人格問卷或上傳交易紀錄 CSV，"
            "這樣我可以根據你的投資風格提供更精準的建議喔！」\n"
            "但如果用戶只是問一般市場問題，不需要每次都提醒。"
        )

    # ── Call Bedrock ──────────────────────────────────────────────────────────
    client = BedrockChatClient()

    try:
        from src.services.bedrock import _load_system_prompt
        base_prompt = _load_system_prompt()
        full_prompt = f"{base_prompt}\n\n{enhanced_system_prompt}"
        ai_reply = client.chat(messages, system_prompt=full_prompt)
    except BedrockError as exc:
        # Log the actual error for debugging
        print(f"[AI_CHAT] Bedrock error: {exc}")
        return _error(503, "AI 服務暫時無法使用，請稍後再試")

    # ── Parse investment suggestion from AI reply ─────────────────────────────
    suggestion = _extract_suggestion(ai_reply, currency)

    return json_response(200, {
        "status": "ready",
        "message": ai_reply,
        "investment_suggestion": suggestion,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
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
        metrics_bytes = storage._get_with_retry(f"users/{user_id}/trade_metrics.json")
        metrics = json.loads(metrics_bytes.decode("utf-8"))
        return metrics.get("personality_analysis", "")
    except Exception:
        return ""


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


def _extract_suggestion(ai_text: str, currency: "str | None") -> "dict | None":
    """Attempt to extract a structured trade suggestion from AI text.

    Returns dict with {currency, action, amount} or None.
    """
    action = None
    if any(kw in ai_text for kw in _BUY_KEYWORDS):
        action = "buy"
    elif any(kw in ai_text for kw in _SELL_KEYWORDS):
        action = "sell"

    if not action:
        return None

    # Try to find an amount
    amount = 5000  # default if not parseable
    match = _AMOUNT_PATTERN.search(ai_text)
    if match:
        try:
            amount = int(match.group(1).replace(",", ""))
        except ValueError:
            pass

    return {
        "currency": currency or "BTC",
        "action": action,
        "amount": amount,
    }


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
