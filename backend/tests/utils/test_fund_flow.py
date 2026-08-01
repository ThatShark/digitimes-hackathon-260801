"""Unit tests for src/utils/fund_flow.py (pure computation, no I/O)."""

from src.utils.fund_flow import classify_trades, compute_daily_net_flow
from src.utils.constants import (
    FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD,
    FUND_FLOW_LARGE_THRESHOLD_TWD,
    FUND_FLOW_MEDIUM_THRESHOLD_TWD,
)


def _trade(funds, side):
    return {"funds": str(funds), "side": side}


# ── classify_trades: size buckets ────────────────────────────────────────────

def test_extra_large_bucket_threshold():
    trades = [_trade(FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD, "bid")]
    result = classify_trades(trades)
    assert result.buckets["extra_large"]["buy"] == FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD
    assert result.trade_count == 1


def test_large_bucket_range():
    trades = [_trade(FUND_FLOW_LARGE_THRESHOLD_TWD, "ask")]
    result = classify_trades(trades)
    assert result.buckets["large"]["sell"] == FUND_FLOW_LARGE_THRESHOLD_TWD
    assert result.buckets["extra_large"]["sell"] == 0.0


def test_medium_bucket_range():
    trades = [_trade(FUND_FLOW_MEDIUM_THRESHOLD_TWD, "bid")]
    result = classify_trades(trades)
    assert result.buckets["medium"]["buy"] == FUND_FLOW_MEDIUM_THRESHOLD_TWD


def test_small_bucket_below_medium_threshold():
    trades = [_trade(FUND_FLOW_MEDIUM_THRESHOLD_TWD - 1, "bid")]
    result = classify_trades(trades)
    assert result.buckets["small"]["buy"] == FUND_FLOW_MEDIUM_THRESHOLD_TWD - 1


def test_just_below_large_threshold_is_medium():
    trades = [_trade(FUND_FLOW_LARGE_THRESHOLD_TWD - 1, "bid")]
    result = classify_trades(trades)
    assert result.buckets["medium"]["buy"] == FUND_FLOW_LARGE_THRESHOLD_TWD - 1
    assert result.buckets["large"]["buy"] == 0.0


def test_just_below_extra_large_threshold_is_large():
    trades = [_trade(FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD - 1, "ask")]
    result = classify_trades(trades)
    assert result.buckets["large"]["sell"] == FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD - 1
    assert result.buckets["extra_large"]["sell"] == 0.0


# ── classify_trades: buy/sell aggregation ────────────────────────────────────

def test_multiple_trades_same_bucket_summed():
    trades = [_trade(50000, "bid"), _trade(70000, "bid"), _trade(40000, "ask")]
    result = classify_trades(trades)
    assert result.buckets["medium"]["buy"] == 120000.0
    assert result.buckets["medium"]["sell"] == 40000.0
    assert result.trade_count == 3


def test_net_inflow_positive_when_buys_exceed_sells():
    trades = [_trade(100000, "bid"), _trade(40000, "ask")]
    result = classify_trades(trades)
    assert result.net_inflow == 60000.0


def test_net_inflow_negative_when_sells_exceed_buys():
    trades = [_trade(40000, "bid"), _trade(100000, "ask")]
    result = classify_trades(trades)
    assert result.net_inflow == -60000.0


def test_net_inflow_zero_for_empty_trades():
    result = classify_trades([])
    assert result.net_inflow == 0.0
    assert result.trade_count == 0
    for bucket in result.buckets.values():
        assert bucket == {"buy": 0.0, "sell": 0.0}


# ── classify_trades: malformed entries skipped, not raised ──────────────────

def test_missing_funds_field_skipped():
    trades = [{"side": "bid"}, _trade(50000, "bid")]
    result = classify_trades(trades)
    assert result.trade_count == 1


def test_non_numeric_funds_skipped():
    trades = [{"funds": "not-a-number", "side": "bid"}, _trade(50000, "bid")]
    result = classify_trades(trades)
    assert result.trade_count == 1


def test_unknown_side_skipped():
    trades = [{"funds": "50000", "side": "unknown"}, _trade(50000, "bid")]
    result = classify_trades(trades)
    assert result.trade_count == 1


def test_negative_funds_skipped():
    trades = [{"funds": "-1000", "side": "bid"}, _trade(50000, "bid")]
    result = classify_trades(trades)
    assert result.trade_count == 1


# ── compute_daily_net_flow ────────────────────────────────────────────────────

def test_daily_net_flow_up_day_is_positive():
    # [time, open, high, low, close, volume]
    klines = [[1700000000, "100", "110", "95", "105", "2.0"]]
    result = compute_daily_net_flow(klines)
    assert len(result) == 1
    assert result[0]["time"] == 1700000000
    assert result[0]["net_flow"] == 105 * 2.0  # close >= open -> positive


def test_daily_net_flow_down_day_is_negative():
    klines = [[1700000000, "110", "115", "95", "100", "2.0"]]
    result = compute_daily_net_flow(klines)
    assert result[0]["net_flow"] == -100 * 2.0  # close < open -> negative


def test_daily_net_flow_flat_day_treated_as_up():
    klines = [[1700000000, "100", "105", "95", "100", "1.0"]]
    result = compute_daily_net_flow(klines)
    assert result[0]["net_flow"] == 100.0  # close == open -> direction +1


def test_daily_net_flow_skips_malformed_candles():
    klines = [
        [1700000000, "100", "110", "95", "105", "2.0"],
        "not-a-candle",
        [1700086400],  # too short
    ]
    result = compute_daily_net_flow(klines)
    assert len(result) == 1


def test_daily_net_flow_preserves_order():
    klines = [
        [1700000000, "100", "110", "95", "105", "1.0"],
        [1700086400, "105", "115", "100", "110", "1.0"],
    ]
    result = compute_daily_net_flow(klines)
    assert [r["time"] for r in result] == [1700000000, 1700086400]
