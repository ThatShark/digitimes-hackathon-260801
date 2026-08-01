"""Fund flow analysis Lambda handler.

Implements GET /market/fund_flow per backend/api.yaml operationId
getFundFlow. Powers FundFlowChart.jsx's 資金流向分析 widget:
  - buckets: real trades from MAX, classified into 特大單/大單/中單/小單
    by TWD value and buy/sell direction (see src/utils/fund_flow.py and
    src/utils/constants.py for the threshold rationale — no industry
    standard exists, thresholds are a documented, tunable convention).
  - daily_net_flow: an approximate 近 7 日淨資金流向 derived from daily
    K-line candles (direction * volume * close_price), not real per-trade
    aggregation — see fund_flow.compute_daily_net_flow()'s docstring for
    why this simplification was chosen (avoids fetching 7 days of raw
    trades, which would be many MAX API calls per request).

Query parameters:
    currency (required) : coin symbol, e.g. "BTC", "ETH", "SOL", "DOGE"
    quote    (optional) : quote currency, default "TWD"
    period   (optional) : "5m" | "1h" | "4h" | "1d", default "1h" — how far
                          back to look when classifying trades into buckets

Success response 200:
{
  "status": "ready",
  "period": "1h",
  "buckets": {
    "extra_large": {"buy": 12000.0, "sell": 3000.0},
    "large":       {"buy": 45000.0, "sell": 38000.0},
    "medium":      {"buy": 60000.0, "sell": 55000.0},
    "small":       {"buy": 20000.0, "sell": 25000.0}
  },
  "net_inflow": 16000.0,
  "trade_count": 842,
  "daily_net_flow": [
    {"time": 1785484800, "net_flow": 1200000.0},
    ...
  ]
}

Error 400 — missing currency, or invalid period
Error 502 — MAX API unreachable after retries (only if the FIRST page of
            trades fails — once we have at least one page, later page
            failures are best-effort: we just stop paging early)
"""

from src.services.max_api import MaxApiClient, MaxApiError
from src.utils.fund_flow import classify_trades, compute_daily_net_flow
from src.utils.http import json_response

_PERIOD_TO_SECONDS = {
    "5m": 5 * 60,
    "1h": 60 * 60,
    "4h": 4 * 60 * 60,
    "1d": 24 * 60 * 60,
}
_DEFAULT_PERIOD = "1h"

# MAX's /trades endpoint returns at most 1000 fills per call. To cover
# longer windows (e.g. "1d") we page backward with the `timestamp` cursor.
# Capped to bound Lambda execution time / MAX API call count per request —
# for a market this illiquid, the window itself is essentially "all
# available trades" anyway.
_MAX_TRADE_PAGES = 5
_TRADES_PER_PAGE = 1000

_DAILY_NET_FLOW_DAYS = 7
_DAILY_KLINE_PERIOD_MINUTES = 1440  # 1 day


def lambda_handler(event, context):
    """GET /market/fund_flow — trade size buckets + 7-day net flow."""
    params = event.get("queryStringParameters") or {}

    currency = params.get("currency", "").strip().upper()
    if not currency:
        return _error(400, "缺少幣種參數 currency")

    period = params.get("period", _DEFAULT_PERIOD).strip()
    if period not in _PERIOD_TO_SECONDS:
        return _error(400, "period 必須為 5m / 1h / 4h / 1d")

    quote = params.get("quote", "TWD").strip().upper()
    market = f"{currency}{quote}".lower()
    window_seconds = _PERIOD_TO_SECONDS[period]

    client = MaxApiClient()

    try:
        trades = _fetch_trades_within_window(client, market, window_seconds)
    except MaxApiError:
        return _error(502, "無法取得成交紀錄，請稍後再試")

    result = classify_trades(trades)

    daily_net_flow = _fetch_daily_net_flow(client, market)

    return json_response(200, {
        "status": "ready",
        "period": period,
        "buckets": result.buckets,
        "net_inflow": result.net_inflow,
        "trade_count": result.trade_count,
        "daily_net_flow": daily_net_flow,
    })


# ─────────────────────────────────────────────────────────────────────────────

def _fetch_trades_within_window(client: MaxApiClient, market: str, window_seconds: int) -> list[dict]:
    """Page backward through MAX's /trades until we've covered
    `window_seconds`, or hit the page cap, or run out of trades.

    The first page's failure propagates (MaxApiError) — without any trades
    at all there's nothing to show. Failures on later pages are swallowed
    and just stop further paging, since we already have partial data.
    """
    import time as _time

    cutoff_ms = (_time.time() - window_seconds) * 1000

    all_trades: list[dict] = []
    cursor_ms = None

    for page in range(_MAX_TRADE_PAGES):
        try:
            batch = client.get_trades(market, limit=_TRADES_PER_PAGE, timestamp_ms=cursor_ms)
        except MaxApiError:
            if page == 0:
                raise
            break

        if not batch:
            break

        all_trades.extend(batch)

        oldest_ms = _oldest_created_at_ms(batch)
        if oldest_ms is None or oldest_ms <= cutoff_ms:
            break
        cursor_ms = oldest_ms

    # Trim any trades older than the window (the last page usually
    # overshoots slightly since we only check the boundary after fetching).
    return [t for t in all_trades if _created_at_ms(t) is not None and _created_at_ms(t) >= cutoff_ms]


def _fetch_daily_net_flow(client: MaxApiClient, market: str) -> list[dict]:
    """Best-effort: returns [] if MAX's K-line endpoint fails, so a fund
    flow issue never blanks out the whole widget."""
    try:
        klines = client.get_klines(market, period=_DAILY_KLINE_PERIOD_MINUTES, limit=_DAILY_NET_FLOW_DAYS)
    except MaxApiError:
        return []
    if not isinstance(klines, list):
        return []
    return compute_daily_net_flow(klines)


def _created_at_ms(trade: dict) -> "int | None":
    try:
        return int(trade.get("created_at"))
    except (TypeError, ValueError):
        return None


def _oldest_created_at_ms(batch: list[dict]) -> "int | None":
    """MAX returns trades newest-first, so the oldest is the last element —
    but guard against malformed entries by scanning explicitly."""
    timestamps = [ts for ts in (_created_at_ms(t) for t in batch) if ts is not None]
    return min(timestamps) if timestamps else None


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
