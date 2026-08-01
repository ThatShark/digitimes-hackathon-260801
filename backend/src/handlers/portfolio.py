"""Portfolio Lambda handler.

Implements GET /portfolio per backend/api.yaml operationId getPortfolio.

Pipeline: read users/{userId}/trades.csv from S3 -> FIFO-reduce to open
positions (backend/src/utils/metrics.py's compute_open_positions) -> look up
each held currency's live price via the MAX public API -> compute per-coin
value/pnl and the portfolio total.

Query parameters:
    user_id (required, until real auth exists)
    quote   (optional) quote currency for price lookups, default TWD

Success response 200 — PortfolioResponse:
{
  "status": "ready",
  "total_value": 181640.0,
  "total_pnl_pct": 4.69,
  "holdings": [
    {"currency": "BTC", "quantity": 0.015, "avg_cost": 2800000.0,
     "current_price": 2850000.0, "value": 42750.0, "pnl_pct": 1.79,
     "allocation_pct": 23.5}
  ]
}

Each holding's price lookup is best-effort: if the MAX API fails for one
currency, that holding is simply omitted from the response (and therefore
from total_value) rather than failing the whole request — a partial
portfolio is more useful than none, same philosophy as market_overview.py.
"""

import os

from src.services.max_api import MaxApiClient, MaxApiError
from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import TradeDataError, compute_open_positions, parse_trades_csv

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """GET /portfolio — holdings x live price -> total value/pnl."""
    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    query_params = event.get("queryStringParameters") or {}
    quote = (query_params.get("quote") or "TWD").strip().upper()

    storage = S3StorageService(bucket_name=os.environ.get(_BUCKET_NAME_ENV_VAR, ""))
    try:
        trades_bytes = storage.get_trades_csv(user_id)
    except S3StorageError:
        return json_response(404, {"status": "need_csv", "message": "尚未上傳交易紀錄，請先上傳 CSV 檔案"})

    try:
        trades = parse_trades_csv(trades_bytes)
    except TradeDataError as exc:
        return _error(400, str(exc))

    positions = compute_open_positions(trades)
    if not positions:
        return json_response(200, {"status": "ready", "total_value": 0.0, "total_pnl_pct": 0.0, "holdings": []})

    client = MaxApiClient()
    holdings = []
    for currency, pos in positions.items():
        price = _fetch_price(client, currency, quote)
        if price is None:
            continue
        quantity = pos["quantity"]
        avg_cost = pos["avg_cost"]
        value = quantity * price
        pnl_pct = ((price - avg_cost) / avg_cost * 100.0) if avg_cost > 0 else 0.0
        holdings.append({
            "currency": currency,
            "quantity": quantity,
            "avg_cost": avg_cost,
            "current_price": price,
            "value": round(value, 2),
            "pnl_pct": round(pnl_pct, 2),
        })

    total_value = sum(h["value"] for h in holdings)
    total_cost = sum(h["quantity"] * h["avg_cost"] for h in holdings)
    total_pnl_pct = round((total_value - total_cost) / total_cost * 100.0, 2) if total_cost > 0 else 0.0

    for h in holdings:
        h["allocation_pct"] = round(h["value"] / total_value * 100.0, 1) if total_value > 0 else 0.0

    holdings.sort(key=lambda h: h["value"], reverse=True)

    return json_response(200, {
        "status": "ready",
        "total_value": round(total_value, 2),
        "total_pnl_pct": total_pnl_pct,
        "holdings": holdings,
    })


# ─────────────────────────────────────────────────────────────────────────────

def _fetch_price(client: MaxApiClient, currency: str, quote: str) -> "float | None":
    market = f"{currency}{quote}".lower()
    try:
        ticker = client.get_ticker(market)
    except MaxApiError:
        return None
    last = ticker.get("last") if isinstance(ticker, dict) else None
    try:
        return float(last)
    except (TypeError, ValueError):
        return None


def _extract_user_id(event) -> "str | None":
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
