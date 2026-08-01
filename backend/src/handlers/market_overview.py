"""Market overview Lambda handler.

Implements GET /market/overview per backend/api.yaml operationId
getMarketOverview. Powers the main page's 行情看板 (MarketOverview.jsx):
Fear & Greed index, BTC dominance, total market cap, 24h volume, and
top gainers/losers.

All data comes from CoinMarketCap's keyless public endpoints — no
calculation logic lives here, only orchestration + response shaping.

Success response 200 — MarketOverviewResponse:
{
  "status": "ready",
  "fear_greed": {"value": 38, "label": "Fear"},
  "btc_dominance": 58.2,
  "total_market_cap": 3120000000000.0,
  "volume_24h": 98500000000.0,
  "top_gainers": [{"symbol": "SOL", "change_24h": 5.7}, ...],
  "top_losers":  [{"symbol": "ETH", "change_24h": -1.2}, ...]
}

Each of the four data sources (fear&greed, global metrics, gainers,
losers) is fetched independently — a failure in one does not fail the
whole response; the corresponding field is simply omitted (null / []).
This mirrors the frontend's existing fallback-to-mock behavior instead of
turning a partial CMC outage into a full 502 for the entire dashboard.

Error 502 — ALL four CMC calls failed (nothing to show)
"""

from src.services.coinmarketcap import CoinMarketCapClient, CoinMarketCapError
from src.utils.constants import RANKABLE_CURRENCIES
from src.utils.http import json_response

_DEFAULT_TOP_N = 3


def lambda_handler(event, context):
    """GET /market/overview"""
    params = event.get("queryStringParameters") or {}

    try:
        top_n = int(params.get("top_n", _DEFAULT_TOP_N))
        if top_n < 1 or top_n > 20:
            raise ValueError
    except (TypeError, ValueError):
        return _error(400, "top_n 必須介於 1 到 20 之間")

    client = CoinMarketCapClient()

    fear_greed = _fetch_fear_greed(client)
    dominance, market_cap, volume_24h = _fetch_global_metrics(client)
    top_gainers, top_losers = _fetch_movers(client, top_n)

    if (
        fear_greed is None
        and dominance is None
        and not top_gainers
        and not top_losers
    ):
        return _error(502, "無法取得行情看板資料，請稍後再試")

    body = {
        "status": "ready",
        "fear_greed": fear_greed,
        "btc_dominance": dominance,
        "total_market_cap": market_cap,
        "volume_24h": volume_24h,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
    }
    return json_response(200, body)


# ─────────────────────────────────────────────────────────────────────────────
# Individual data source fetchers — each best-effort, returns None/[] on failure
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_fear_greed(client: CoinMarketCapClient) -> "dict | None":
    try:
        raw = client.get_fear_greed_latest()
    except CoinMarketCapError:
        return None

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, dict) or "value" not in data:
        return None

    return {
        "value": int(data["value"]),
        "label": data.get("value_classification", ""),
    }


def _fetch_global_metrics(client: CoinMarketCapClient):
    """Returns (btc_dominance, total_market_cap, volume_24h), each None on failure."""
    try:
        raw = client.get_global_metrics(convert="USD")
    except CoinMarketCapError:
        return None, None, None

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, dict):
        return None, None, None

    dominance = _to_float(data.get("btc_dominance"))

    quote = data.get("quote", {})
    usd_quote = quote.get("USD", {}) if isinstance(quote, dict) else {}
    market_cap = _to_float(usd_quote.get("total_market_cap"))
    volume_24h = _to_float(usd_quote.get("total_volume_24h"))

    return dominance, market_cap, volume_24h


# Ranking pool size: pull the top N coins by market cap from CMC, then
# filter down to RANKABLE_CURRENCIES (the 6 coins this product actually
# supports, minus stablecoins) before sorting by 24h % change. This product
# only ever shows BTC/ETH/SOL/DOGE/USDT/USDC — surfacing gainers/losers from
# the full CMC universe (e.g. ADA, DOT, PEPE) would show coins the user
# can't view or trade here at all, on top of the pre-existing microcap-noise
# problem (near-zero-market-cap tokens with meaningless four-digit swings).
_RANKING_POOL_SIZE = 100


def _fetch_movers(client: CoinMarketCapClient, limit: int):
    """Returns (top_gainers, top_losers), each [] on failure — gainers/losers
    are non-critical widgets, a failure here must not fail the whole request.
    Single API call serves both lists (sorted from the same candidate pool).
    Only ranks RANKABLE_CURRENCIES (excludes stablecoins — their 24h change
    is always ~0% and carries no signal for a "movers" widget).
    """
    try:
        raw = client.get_listings(
            start=1, limit=_RANKING_POOL_SIZE, convert="USD", sort="market_cap",
        )
    except CoinMarketCapError:
        return [], []

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, list):
        return [], []

    candidates = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        symbol = entry.get("symbol")
        if symbol is None or symbol not in RANKABLE_CURRENCIES:
            continue
        change = _extract_usd_quote_field(entry, "percent_change_24h")
        if change is None:
            continue
        candidates.append({"symbol": symbol, "change_24h": round(change, 1)})

    gainers = sorted(candidates, key=lambda m: m["change_24h"], reverse=True)[:limit]
    losers = sorted(candidates, key=lambda m: m["change_24h"])[:limit]
    return gainers, losers


def _extract_usd_quote_field(entry: dict, field: str) -> "float | None":
    """CMC's keyless listings endpoint returns `quote` as a LIST of
    per-currency objects (e.g. [{"symbol": "USD", ...}]), not a dict keyed
    by currency code as on the authenticated Pro API. Find the USD entry
    by its "symbol" field.
    """
    quote = entry.get("quote")
    if not isinstance(quote, list):
        return None
    for q in quote:
        if isinstance(q, dict) and q.get("symbol") == "USD":
            return _to_float(q.get(field))
    return None


def _to_float(value) -> "float | None":
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
