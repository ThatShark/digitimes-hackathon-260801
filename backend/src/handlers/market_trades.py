"""Market trades (recent fills) Lambda handler.

Implements GET /market/trades per backend/api.yaml operationId getRecentTrades.
Thin proxy over MAX's public trades endpoint — powers RecentTrades.jsx (the
"最新成交" stream). For the fund-flow size-bucket analysis widget, see
market_fund_flow.py instead — this handler only returns the raw recent-fills
list, not any aggregation.

Query parameters:
    currency (required) : coin symbol, e.g. "BTC", "ETH", "SOL", "DOGE"
    quote    (optional) : quote currency, default "TWD"
    limit    (optional) : number of trades, default 20, max 1000 (MAX's own cap)

Success response 200:
{
  "status": "ready",
  "trades": [
    {"price": 2032000.0, "volume": 0.0065, "side": "buy", "timestamp": 1785606737},
    ...
  ]
}
(newest first, matching MAX's own ordering; side is "buy"/"sell", mapped
from MAX's bid/ask; timestamp is Unix seconds)

Error 400 — missing currency, or limit out of range
Error 502 — MAX API unreachable after retries
"""

from src.services.max_api import MaxApiClient, MaxApiError
from src.utils.http import json_response

_DEFAULT_LIMIT = 20
_MAX_LIMIT = 1000  # MAX's own hard cap on /trades


def lambda_handler(event, context):
    """GET /market/trades — recent fills for a single currency."""
    params = event.get("queryStringParameters") or {}

    currency = params.get("currency", "").strip().upper()
    if not currency:
        return _error(400, "缺少幣種參數 currency")

    quote = params.get("quote", "TWD").strip().upper()

    limit_raw = params.get("limit")
    limit = _DEFAULT_LIMIT
    if limit_raw is not None:
        try:
            limit = int(limit_raw)
        except ValueError:
            return _error(400, "limit 必須為整數")
        if limit < 1 or limit > _MAX_LIMIT:
            return _error(400, f"limit 必須在 1 到 {_MAX_LIMIT} 之間")

    market = f"{currency}{quote}".lower()

    client = MaxApiClient()
    try:
        raw_trades = client.get_trades(market, limit=limit)
    except MaxApiError:
        return _error(502, "無法取得成交明細，請稍後再試")

    if not isinstance(raw_trades, list):
        return _error(502, "MAX API 回傳格式異常")

    trades = []
    for t in raw_trades:
        if not isinstance(t, dict):
            continue
        parsed = _parse_trade(t)
        if parsed is not None:
            trades.append(parsed)

    return json_response(200, {"status": "ready", "trades": trades})


def _parse_trade(t: dict) -> "dict | None":
    try:
        price = float(t["price"])
        volume = float(t["volume"])
        created_at_ms = int(t["created_at"])
    except (KeyError, TypeError, ValueError):
        return None

    side = "buy" if t.get("side") == "bid" else "sell" if t.get("side") == "ask" else None
    if side is None:
        return None

    return {
        "price": price,
        "volume": volume,
        "side": side,
        "timestamp": created_at_ms // 1000,
    }


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
