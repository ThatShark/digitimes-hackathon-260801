"""Candlestick chart Lambda handler.

Implements GET /candlestick_chart per backend/api.yaml operationId
getCandlestickChart.

Query parameters:
    currency (required) : coin symbol, e.g. "BTC", "ETH", "SOL"
    start    (required) : Unix timestamp (seconds) — chart window start
    end      (required) : Unix timestamp (seconds) — chart window end
    interval (optional) : "1d" | "1M" | "1Y", default "1M"
    quote    (optional) : quote currency, default "TWD"

Interval → MAX period mapping
┌──────────┬──────────────────────┬──────────────────────────────────────┐
│ interval │ MAX period (minutes) │ Rationale                            │
├──────────┼──────────────────────┼──────────────────────────────────────┤
│ 1d       │ 60  (1 hour)         │ 24 candles/day — good intraday detail│
│ 1M       │ 1440 (1 day)         │ 1 candle/day — 30 candles/month      │
│ 1Y       │ 10080 (1 week)       │ 1 candle/week — ~52 candles/year     │
└──────────┴──────────────────────┴──────────────────────────────────────┘

The limit is derived from (end - start) / period_seconds, capped at 1000,
so the caller controls the window entirely via start/end.

Success response 200 — CandlestickChartResponse (from api.yaml):
{
  "status": "ready",
  "candles": [
    {"time": 1785488400, "open": 2067054.0, "high": 2069657.8,
     "low": 2062192.8, "close": 2065084.6, "volume": 1.6542},
    ...
  ],
  "trade_markers": [                // empty list when no CSV on S3
    {"time": 1719792000, "action": "buy",  "price": 2050000.0, "amount": 10000.0},
    {"time": 1720000000, "action": "sell", "price": 2100000.0, "amount": 10500.0},
    ...
  ]
}

Error responses:
  400 — missing/invalid params
  502 — MAX API unreachable after retries
"""

import json
import math
import os
from calendar import timegm
from datetime import datetime, timezone

from backend.src.services.max_api import MaxApiClient, MaxApiError
from backend.src.services.s3_storage import S3StorageError, S3StorageService
from backend.src.utils.metrics import TradeDataError, parse_trades_csv

# ── Interval → MAX period (minutes) ──────────────────────────────────────────
_INTERVAL_TO_PERIOD: dict[str, int] = {
    "1d": 60,     # 1-hour candles for a 24 h window
    "1M": 1440,   # 1-day candles for a 30-day window
    "1Y": 10080,  # 1-week candles for a 365-day window
}
_DEFAULT_INTERVAL = "1M"
_MAX_CANDLE_LIMIT = 1000   # safety cap — MAX supports up to 10 000

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


# ─────────────────────────────────────────────────────────────────────────────
# Handler
# ─────────────────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    """GET /candlestick_chart"""
    params = event.get("queryStringParameters") or {}

    # ── Validate currency ────────────────────────────────────────────────────
    currency = params.get("currency", "").strip().upper()
    if not currency:
        return _error(400, "缺少幣種參數 currency")

    # ── Validate start / end ─────────────────────────────────────────────────
    try:
        start = int(params["start"])
        end   = int(params["end"])
    except (KeyError, ValueError, TypeError):
        return _error(400, "缺少或無效的時間參數 start / end（需為 Unix 秒數）")

    if end <= start:
        return _error(400, "end 必須大於 start")

    # ── Resolve interval & MAX period ────────────────────────────────────────
    interval = params.get("interval", _DEFAULT_INTERVAL).strip()
    if interval not in _INTERVAL_TO_PERIOD:
        return _error(
            400,
            f"不支援的 interval 值 '{interval}'，請使用 1d / 1M / 1Y",
        )
    period_minutes = _INTERVAL_TO_PERIOD[interval]
    period_seconds = period_minutes * 60

    # Compute limit from the requested time window, capped for safety.
    raw_limit = math.ceil((end - start) / period_seconds)
    limit = max(1, min(raw_limit, _MAX_CANDLE_LIMIT))

    quote = params.get("quote", "TWD").strip().upper()
    market = f"{currency}{quote}".lower()   # e.g. "btctwd"

    # ── Fetch K-line data from MAX ───────────────────────────────────────────
    max_client = MaxApiClient()
    try:
        raw_klines = max_client.get_klines(
            market=market,
            period=period_minutes,
            limit=limit,
            timestamp=start,
        )
    except MaxApiError:
        return _error(502, "無法取得 K 線資料，請稍後再試")

    if not isinstance(raw_klines, list):
        return _error(502, "MAX API 回傳格式異常")

    # Filter to [start, end] window (MAX may return candles starting at or
    # after start; trim any stray candles that fall outside end).
    candles = [
        {
            "time":   int(row[0]),
            "open":   float(row[1]),
            "high":   float(row[2]),
            "low":    float(row[3]),
            "close":  float(row[4]),
            "volume": float(row[5]),
        }
        for row in raw_klines
        if isinstance(row, (list, tuple)) and len(row) >= 6
        and start <= int(row[0]) <= end
    ]

    # ── Fetch trade markers from S3 CSV (best-effort) ────────────────────────
    trade_markers = _load_trade_markers(event, currency, start, end)

    return _success(candles, trade_markers)


# ─────────────────────────────────────────────────────────────────────────────
# Trade markers
# ─────────────────────────────────────────────────────────────────────────────

def _load_trade_markers(
    event: dict,
    currency: str,
    start: int,
    end: int,
) -> list[dict]:
    """Load the user's buy/sell fills for *currency* from S3 and return them
    as TradeMarker dicts filtered to [start, end].

    Returns an empty list on any error (missing CSV, bad CSV, no S3 config)
    so that the K-line data is always returned even without trade history.
    """
    user_id = _extract_user_id(event)
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if not user_id or not bucket:
        return []

    storage = S3StorageService(bucket_name=bucket)
    try:
        csv_bytes = storage.get_trades_csv(user_id)
    except S3StorageError:
        return []

    try:
        fills = parse_trades_csv(csv_bytes)
    except TradeDataError:
        return []

    markers: list[dict] = []
    for fill in fills:
        if fill.currency.upper() != currency:
            continue

        # Convert the naive CSV datetime to a UTC Unix timestamp.
        # The CSV timestamps are stored as Taiwan local time (UTC+8), but
        # parse_trades_csv returns them as naive datetimes. We treat them
        # as UTC here for timestamp comparison — a known approximation
        # (±8h) that is acceptable for chart overlay purposes.
        ts = timegm(fill.timestamp.timetuple())
        if not (start <= ts <= end):
            continue

        markers.append({
            "time":   ts,
            "action": fill.side,          # "buy" or "sell"
            "price":  fill.price,
            "amount": round(fill.price * fill.volume, 2),  # TWD value
        })

    # Sort chronologically for frontend convenience.
    markers.sort(key=lambda m: m["time"])
    return markers


def _extract_user_id(event: dict) -> "str | None":
    """Extract user ID from Lambda event (query param → path param → Cognito)."""
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


# ─────────────────────────────────────────────────────────────────────────────
# Response builders
# ─────────────────────────────────────────────────────────────────────────────

def _success(candles: list[dict], trade_markers: list[dict]) -> dict:
    body = {
        "status":        "ready",
        "candles":       candles,
        "trade_markers": trade_markers,
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
