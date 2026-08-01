"""Market depth (order book) Lambda handler.

Implements GET /market/depth per backend/api.yaml operationId getOrderBook.
Thin proxy over MAX's public depth endpoint — powers DepthChart.jsx.

Query parameters:
    currency (required) : coin symbol, e.g. "BTC", "ETH", "SOL", "DOGE"
    quote    (optional) : quote currency, default "TWD"
    limit    (optional) : price levels per side, default 20, max 300 (MAX's own cap)

Success response 200:
{
  "status": "ready",
  "bids": [[price, volume], ...],  // best bid first
  "asks": [[price, volume], ...]   // best ask first
}
(price/volume as numbers — MAX returns them as strings, coerced here)

Error 400 — missing currency, or limit out of range
Error 502 — MAX API unreachable after retries
"""

from src.services.max_api import MaxApiClient, MaxApiError
from src.utils.http import json_response

_DEFAULT_LIMIT = 20
_MAX_LIMIT = 300  # MAX's own hard cap on /depth


def lambda_handler(event, context):
    """GET /market/depth — order book depth for a single currency."""
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
        raw = client.get_depth(market, limit=limit)
    except MaxApiError:
        return _error(502, "無法取得深度圖資料，請稍後再試")

    if not isinstance(raw, dict) or "asks" not in raw or "bids" not in raw:
        return _error(502, "MAX API 回傳格式異常")

    bids = _coerce_levels(raw.get("bids"))
    asks = _coerce_levels(raw.get("asks"))

    return json_response(200, {"status": "ready", "bids": bids, "asks": asks})


def _coerce_levels(levels) -> list:
    """MAX returns [[price_str, volume_str], ...]; coerce to floats.
    Skips malformed entries rather than failing the whole response."""
    if not isinstance(levels, list):
        return []
    result = []
    for level in levels:
        if not isinstance(level, (list, tuple)) or len(level) != 2:
            continue
        try:
            result.append([float(level[0]), float(level[1])])
        except (TypeError, ValueError):
            continue
    return result


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
