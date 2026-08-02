"""Fund-flow analysis (資金流向分析) — pure computation, no I/O.

Classifies a list of MAX trades (from max_api.py's get_trades()) into
size buckets (特大單/大單/中單/小單) and buy/sell direction, for the
FundFlowChart.jsx widget on CoinTrendPage.

See backend/src/utils/constants.py for the threshold rationale — this is
a self-disclosed classification convention (no industry standard exists),
based on real trade data from MAX, not fabricated numbers.
"""

from dataclasses import dataclass

from src.utils.constants import (
    FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD,
    FUND_FLOW_LARGE_THRESHOLD_TWD,
    FUND_FLOW_MEDIUM_THRESHOLD_TWD,
)

_BUCKETS = ("extra_large", "large", "medium", "small")


@dataclass
class FundFlowResult:
    # Each bucket's {"buy": float, "sell": float} in TWD (both non-negative;
    # "buy"/"sell" reflect the trade's `side` from MAX: bid=buy, ask=sell).
    buckets: dict
    net_inflow: float  # total buy TWD - total sell TWD, across all buckets
    trade_count: int


def _classify_size(funds_twd: float) -> str:
    """Bucket a single trade by its TWD value. See constants.py for rationale."""
    if funds_twd >= FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD:
        return "extra_large"
    if funds_twd >= FUND_FLOW_LARGE_THRESHOLD_TWD:
        return "large"
    if funds_twd >= FUND_FLOW_MEDIUM_THRESHOLD_TWD:
        return "medium"
    return "small"


def classify_trades(trades: list[dict]) -> FundFlowResult:
    """Classify raw MAX trade dicts (as returned by MaxApiClient.get_trades())
    into size buckets and buy/sell totals.

    Each trade dict is expected to have `funds` (TWD value, string or
    number) and `side` ("bid" = buy, "ask" = sell). Malformed entries
    (missing/non-numeric funds, unrecognized side) are skipped rather than
    raising — a live-data feed can have stray entries and this is a
    best-effort analysis widget, not a financial ledger.
    """
    buckets = {b: {"buy": 0.0, "sell": 0.0} for b in _BUCKETS}
    counted = 0

    for trade in trades:
        try:
            funds = float(trade.get("funds"))
        except (TypeError, ValueError):
            continue
        side = trade.get("side")
        if side not in ("bid", "ask") or funds < 0:
            continue

        bucket = _classify_size(funds)
        key = "buy" if side == "bid" else "sell"
        buckets[bucket][key] += funds
        counted += 1

    net_inflow = sum(b["buy"] - b["sell"] for b in buckets.values())

    # Round every value to 2 decimal places before returning — summing many
    # floats (TWD trade values) accumulates binary floating-point error
    # (e.g. 336.4 can come out as 336.40000000000003), which would otherwise
    # leak straight through to the API response and the UI.
    rounded_buckets = {
        b: {"buy": round(v["buy"], 2), "sell": round(v["sell"], 2)}
        for b, v in buckets.items()
    }

    return FundFlowResult(buckets=rounded_buckets, net_inflow=round(net_inflow, 2), trade_count=counted)


def compute_daily_net_flow(klines: list) -> list[dict]:
    """Derive an approximate daily net fund flow (近 N 日淨資金流向) from
    daily K-line candles, without needing to fetch N days of raw trades.

    Each candle is ``[time_seconds, open, high, low, close, volume]`` (MAX's
    K-line shape, see max_api.py's get_klines()). `volume` is in the base
    currency (coin units), not TWD, so we approximate the TWD-value of that
    day's net flow as ``volume * close_price``, signed by whether the day
    closed up (net inflow) or down (net outflow).

    This is a simplification — it doesn't know the actual buy/sell split
    within the day, just the day's overall price direction — but avoids
    fetching a full day's worth of individual trades for each of the last
    7 days, which would be many MAX API calls per request.
    """
    results = []
    for candle in klines:
        if not isinstance(candle, (list, tuple)) or len(candle) < 6:
            continue
        try:
            time_s = int(candle[0])
            open_price = float(candle[1])
            close_price = float(candle[4])
            volume = float(candle[5])
        except (TypeError, ValueError):
            continue

        direction = 1 if close_price >= open_price else -1
        net_flow = direction * volume * close_price
        results.append({"time": time_s, "net_flow": round(net_flow, 2)})

    return results
