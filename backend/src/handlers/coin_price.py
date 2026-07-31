"""Coin price Lambda handler.

Implements GET /coin/price per backend/api.yaml operationId getCoinPrice.

Query parameters:
    currency (required) : coin symbol, e.g. "BTC", "ETH", "SOL", "DOGE"
    quote    (optional) : quote currency, default "TWD"

Success response 200 — CoinPriceResponse:
{
  "status":  "ready",
  "currency": "BTC",
  "market":  "btctwd",
  "last":    2059233.9,   // latest trade price
  "buy":     2059000.0,   // best bid
  "sell":    2061197.9,   // best ask
  "open":    2101373.9,   // 24 h open
  "high":    2117830.3,   // 24 h high
  "low":     2059000.0,   // 24 h low
  "vol":     26.5657,     // 24 h volume (base currency)
  "at":      1785504705   // server timestamp (Unix seconds)
}

Error 400 — missing currency param
Error 404 — market not found on MAX
Error 502 — MAX API unreachable after retries
"""

import json

from backend.src.services.max_api import MaxApiClient, MaxApiError


def lambda_handler(event, context):
    """GET /coin/price — returns latest price for the requested currency."""
    query_params = event.get("queryStringParameters") or {}

    currency = query_params.get("currency", "").strip().upper()
    if not currency:
        return _error(400, "缺少幣種參數 currency")

    quote = query_params.get("quote", "TWD").strip().upper()
    market = f"{currency}{quote}".lower()   # e.g. "btctwd"

    client = MaxApiClient()
    try:
        ticker = client.get_ticker(market)
    except MaxApiError:
        return _error(502, "無法取得幣種價格，請稍後再試")

    # MAX returns a dict with a "last" key for a valid market.
    # An unknown market typically causes an HTTPError caught by MaxApiError,
    # but guard defensively in case the shape changes.
    if not isinstance(ticker, dict) or "last" not in ticker:
        return _error(404, f"找不到市場 {market}，請確認幣種是否正確")

    return _success(currency, ticker)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _success(currency: str, ticker: dict) -> dict:
    body = {
        "status":   "ready",
        "currency": currency,
        "market":   ticker.get("market", ""),
        "last":     _float(ticker.get("last")),
        "buy":      _float(ticker.get("buy")),
        "sell":     _float(ticker.get("sell")),
        "open":     _float(ticker.get("open")),
        "high":     _float(ticker.get("high")),
        "low":      _float(ticker.get("low")),
        "vol":      _float(ticker.get("vol")),
        "at":       ticker.get("at"),
    }
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _error(status_code: int, message: str) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {"status": "error", "message": message}, ensure_ascii=False
        ),
    }


def _float(value) -> "float | None":
    """MAX returns numeric fields as strings; coerce to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
