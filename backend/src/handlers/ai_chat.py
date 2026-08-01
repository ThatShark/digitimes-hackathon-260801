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
import re

from src.services.bedrock import BedrockChatClient, BedrockError
from src.utils.http import json_response

# Keywords to detect trade suggestions in AI response
_BUY_KEYWORDS = ["建議買入", "建議買", "推薦買入", "suggest buy", "建議加倉"]
_SELL_KEYWORDS = ["建議賣出", "建議賣", "建議出場", "suggest sell", "建議停損"]

# Regex to extract amount (e.g. "5000", "NT$5,000", "5000 TWD")
_AMOUNT_PATTERN = re.compile(r"(?:NT\$?\s?|TWD\s?)?(\d[\d,]*)")


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

    # ── Build Bedrock messages ────────────────────────────────────────────────
    # Single-turn for now; frontend can extend to multi-turn by sending history
    user_content = message
    if currency:
        user_content = f"[目前查看幣種: {currency}] {message}"

    messages = [
        {"role": "user", "content": [{"text": user_content}]},
    ]

    # ── Call Bedrock ──────────────────────────────────────────────────────────
    client = BedrockChatClient()

    try:
        ai_reply = client.chat(messages)
    except BedrockError:
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
