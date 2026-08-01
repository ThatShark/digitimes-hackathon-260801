"""Allow Trade Lambda handler.

Implements POST /allow_trade per backend/api.yaml operationId allowTrade.

Request body (AllowTradeRequest):
{
  "currency": "BTC",
  "action": "buy",      // "buy" or "sell"
  "amount": 5000        // TWD amount
}

Success response 200 (AllowTradeResponse):
{
  "status": "success",
  "message": "成功買入 NT$5,000 的 BTC",
  "trade_id": "12345678",
  "order": { ... }      // raw MAX order response
}

Error responses:
  400 — missing params, invalid action, insufficient balance
  502 — MAX API unavailable
  503 — MAX trading not configured
"""

import json

from src.services.max_api import MaxApiClient, MaxApiError
from src.services.max_trading import MaxTradingClient, MaxTradingError
from src.utils.http import json_response


def lambda_handler(event, context):
    """POST /allow_trade"""
    # ── Parse request body ────────────────────────────────────────────────────
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    currency = (body.get("currency") or "").strip().upper()
    action = (body.get("action") or "").strip().lower()
    amount = body.get("amount")

    if not currency:
        return _error(400, "缺少幣種參數 currency")
    if action not in ("buy", "sell"):
        return _error(400, "action 必須為 buy 或 sell")
    if not amount or not isinstance(amount, (int, float)) or amount <= 0:
        return _error(400, "amount 必須為正數（TWD 金額）")

    market = f"{currency.lower()}twd"

    # ── Get latest price to calculate volume ──────────────────────────────────
    try:
        max_public = MaxApiClient()
        ticker = max_public.get_ticker(market)
    except MaxApiError:
        return _error(502, "無法取得最新價格，請稍後再試")

    if not isinstance(ticker, dict) or "last" not in ticker:
        return _error(400, f"找不到市場 {market}，請確認幣種是否正確")

    last_price = float(ticker["last"])
    if last_price <= 0:
        return _error(502, "目前無法取得有效報價")

    # ── Calculate volume ──────────────────────────────────────────────────────
    # For buy: volume = TWD amount / price (how much coin to buy)
    # For sell: volume = TWD amount / price (how much coin to sell)
    volume = amount / last_price

    # MAX requires volume as a string; apply reasonable precision
    # Most crypto pairs use 8 decimal places
    volume_str = f"{volume:.8f}".rstrip("0").rstrip(".")

    # ── Place order via MAX authenticated API ─────────────────────────────────
    try:
        trading_client = MaxTradingClient()
    except MaxTradingError as exc:
        return _error(503, str(exc))

    try:
        order = trading_client.create_order(
            market=market,
            side=action,
            volume=volume_str,
            ord_type="market",
        )
    except MaxTradingError as exc:
        # Map known error codes to user-friendly messages
        if exc.code == 2007:
            return _error(400, "餘額不足，無法執行此交易")
        if exc.code == 2004:
            return _error(400, f"交易量太小，最低要求未達標")
        print(f"[ALLOW_TRADE] MAX error: code={exc.code} msg={exc}")
        return _error(502, f"交易所下單失敗：{exc}")

    # ── Build success response ────────────────────────────────────────────────
    trade_id = str(order.get("id", ""))
    action_text = "買入" if action == "buy" else "賣出"
    message = f"成功{action_text} NT${amount:,.0f} 的 {currency}"

    return json_response(200, {
        "status": "success",
        "message": message,
        "trade_id": trade_id,
        "order": {
            "id": order.get("id"),
            "market": order.get("market"),
            "side": order.get("side"),
            "volume": order.get("volume"),
            "price": order.get("price"),
            "state": order.get("state"),
            "ord_type": order.get("ord_type"),
            "created_at": order.get("created_at"),
        },
    })


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
