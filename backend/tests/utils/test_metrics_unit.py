"""Unit tests for parse_trades_csv, match_fifo_trades, and calculate_metrics
edge cases that aren't well suited to property-based testing."""

from datetime import datetime, timedelta

import pytest

from backend.src.utils.metrics import (
    Candle,
    RawFill,
    TradeDataError,
    TradeRecord,
    calculate_chase_up_indices,
    calculate_metrics,
    calculate_mti_hours,
    determine_delta_t_hours,
    match_fifo_trades,
    parse_klines_json,
    parse_trades_csv,
)

_CSV_HEADER = "時間,交易對,類型,價格,數量,總金額,手續費,手續費幣種"


def test_calculate_metrics_raises_on_empty_records():
    """calculate_metrics([]) must raise TradeDataError."""
    with pytest.raises(TradeDataError):
        calculate_metrics([])


def test_parse_trades_csv_header_only_returns_empty_list():
    """A header-only CSV (zero data rows) is valid and returns []."""
    assert parse_trades_csv(_CSV_HEADER + "\n") == []


def test_end_to_end_fifo_match_on_small_fixture():
    """parse_trades_csv + match_fifo_trades on a hand-written 3-row BTC
    fixture (2 buys + 1 sell) produces the exact expected FIFO-matched
    TradeRecord(s)."""
    csv_text = "\n".join(
        [
            _CSV_HEADER,
            "2024/07/29 08:00:00,BTC/TWD,買入,2000000,0.01,20000,14,TWD",
            "2024/07/30 08:00:00,BTC/TWD,買入,2100000,0.02,42000,29.4,TWD",
            "2024/07/31 08:00:00,BTC/TWD,賣出,2200000,0.015,33000,23.1,TWD",
        ]
    )

    fills = parse_trades_csv(csv_text)
    assert len(fills) == 3

    records = match_fifo_trades(fills)

    # The sell (0.015 BTC) fully consumes the first buy lot (0.01 BTC @
    # 2,000,000) and partially consumes the second buy lot (0.005 of 0.02
    # BTC @ 2,100,000). Two TradeRecords are expected.
    assert len(records) == 2

    first, second = records

    assert first.currency == "BTC"
    assert first.buy_price == 2000000.0
    assert first.sell_price == 2200000.0
    assert first.amount == pytest.approx(0.01 * 2000000.0)
    assert first.is_stablecoin is False
    assert first.buy_time.isoformat() == "2024-07-29T08:00:00"
    assert first.sell_time.isoformat() == "2024-07-31T08:00:00"

    assert second.currency == "BTC"
    assert second.buy_price == 2100000.0
    assert second.sell_price == 2200000.0
    assert second.amount == pytest.approx(0.005 * 2100000.0)
    assert second.is_stablecoin is False
    assert second.buy_time.isoformat() == "2024-07-30T08:00:00"
    assert second.sell_time.isoformat() == "2024-07-31T08:00:00"

    # The remaining 0.015 BTC of the second buy lot stays open (unsold) and
    # must not produce a TradeRecord.


def test_sell_exceeding_all_buy_volume_raises_trade_data_error():
    """A sell row whose volume exceeds all recorded prior buy volume for
    that currency raises TradeDataError (incomplete fill history)."""
    csv_text = "\n".join(
        [
            _CSV_HEADER,
            "2024/07/29 08:00:00,BTC/TWD,買入,2000000,0.01,20000,14,TWD",
            "2024/07/31 08:00:00,BTC/TWD,賣出,2200000,0.05,110000,77,TWD",
        ]
    )

    fills = parse_trades_csv(csv_text)
    with pytest.raises(TradeDataError):
        match_fifo_trades(fills)


def test_parse_trades_csv_missing_required_column_raises():
    """A header missing a required column (e.g. 數量) raises TradeDataError."""
    csv_text = "\n".join(
        [
            "時間,交易對,類型,價格,總金額,手續費,手續費幣種",
            "2024/07/29 08:00:00,BTC/TWD,買入,2000000,20000,14,TWD",
        ]
    )
    with pytest.raises(TradeDataError):
        parse_trades_csv(csv_text)


def test_parse_trades_csv_invalid_market_pair_raises():
    csv_text = "\n".join(
        [
            _CSV_HEADER,
            "2024/07/29 08:00:00,BTCTWD,買入,2000000,0.01,20000,14,TWD",
        ]
    )
    with pytest.raises(TradeDataError):
        parse_trades_csv(csv_text)


def test_parse_trades_csv_invalid_side_raises():
    """An unrecognized 類型 value (neither 買入 nor 賣出) raises TradeDataError."""
    csv_text = "\n".join(
        [
            _CSV_HEADER,
            "2024/07/29 08:00:00,BTC/TWD,持有,2000000,0.01,20000,14,TWD",
        ]
    )
    with pytest.raises(TradeDataError):
        parse_trades_csv(csv_text)


def test_parse_trades_csv_no_header_raises():
    with pytest.raises(TradeDataError):
        parse_trades_csv("")


def test_parse_trades_csv_price_with_thousands_separator():
    """價格/數量 with thousands-separator commas are parsed correctly."""
    csv_text = "\n".join(
        [
            _CSV_HEADER,
            '2024/07/29 08:00:00,BTC/TWD,買入,"2,150,000",0.01,21500,15,TWD',
        ]
    )
    fills = parse_trades_csv(csv_text)
    assert fills[0].price == 2150000.0


def test_stablecoin_currency_excluded_from_by_currency():
    """A stablecoin currency group (e.g. USDT) does not appear as a key in
    by_currency, but still contributes to stablecoin_ratio_pct."""
    records = [
        TradeRecord(
            buy_time=datetime(2024, 1, 1),
            sell_time=datetime(2024, 1, 2),
            amount=1000.0,
            is_stablecoin=True,
            buy_price=1.0,
            sell_price=1.0,
            currency="USDT",
        ),
        TradeRecord(
            buy_time=datetime(2024, 1, 1),
            sell_time=datetime(2024, 1, 2),
            amount=500.0,
            is_stablecoin=False,
            buy_price=100.0,
            sell_price=110.0,
            currency="BTC",
        ),
    ]

    result = calculate_metrics(records)

    assert "USDT" not in result.by_currency
    assert "BTC" in result.by_currency
    assert result.overall.stablecoin_ratio_pct == round(1000.0 / 1500.0 * 100, 2)


# --- calculate_mti_hours --------------------------------------------------


def test_calculate_mti_hours_returns_none_for_fewer_than_two_timestamps():
    assert calculate_mti_hours([]) is None
    assert calculate_mti_hours([datetime(2024, 1, 1)]) is None


def test_calculate_mti_hours_known_median():
    """4 timestamps spaced 1h, 2h, 3h apart (in that order once sorted)
    give gaps [1, 2, 3] -> median 2.0."""
    base = datetime(2024, 1, 1, 0, 0, 0)
    timestamps = [
        base,
        base + timedelta(hours=1),
        base + timedelta(hours=3),
        base + timedelta(hours=6),
    ]
    assert calculate_mti_hours(timestamps) == 2.0


def test_calculate_mti_hours_only_uses_most_recent_500():
    """Construct a scenario where using ALL timestamps vs. only the most
    recent 500 gives a different median, proving the truncation happens.

    The oldest 100 timestamps are spaced 100h apart (huge gaps); the most
    recent 500 are spaced 1h apart (tiny gaps). If truncation didn't
    happen, the huge 100h gaps would dominate/skew the median upward;
    with truncation, only the uniform 1h gaps remain and the median must
    be exactly 1.0.
    """
    base = datetime(2024, 1, 1)
    timestamps = []
    t = base
    for _ in range(100):
        timestamps.append(t)
        t += timedelta(hours=100)
    for _ in range(501):
        timestamps.append(t)
        t += timedelta(hours=1)

    # Total timestamps: 601, most recent 500 are all part of the 1h-spaced
    # tail (the last 500 of the 501 1h-spaced entries), giving 499 gaps of
    # exactly 1.0h -> median 1.0.
    assert calculate_mti_hours(timestamps) == 1.0


# --- determine_delta_t_hours ----------------------------------------------


def test_determine_delta_t_hours_scalper_tier():
    assert determine_delta_t_hours(1.0) == 0.25


def test_determine_delta_t_hours_day_trader_tier():
    assert determine_delta_t_hours(12.0) == 1.0


def test_determine_delta_t_hours_swing_trader_tier():
    assert determine_delta_t_hours(48.0) == 4.0


def test_determine_delta_t_hours_hodler_tier():
    assert determine_delta_t_hours(200.0) == 24.0


def test_determine_delta_t_hours_none_fallback_defaults_to_day_trader():
    """Fewer than 2 buy fills (MTI is None) falls back to the Day Trader
    tier (Δt = 1.0h) -- the judgment call flagged to and accepted by the
    user in the task spec."""
    assert determine_delta_t_hours(None) == 1.0


# --- parse_klines_json -----------------------------------------------------


def test_parse_klines_json_valid_input():
    json_content = (
        '[[1722333600, "2150000.0", "2160000.0", "2140000.0", "2155000.0", "12.45"],'
        ' [1722334500, 2155000.0, 2170000.0, 2150000.0, 2168000.0, 8.32]]'
    )
    candles = parse_klines_json(json_content)

    assert len(candles) == 2
    first, second = candles
    assert isinstance(first, Candle)
    assert first.open == 2150000.0
    assert first.high == 2160000.0
    assert first.low == 2140000.0
    assert first.close == 2155000.0
    assert first.volume == 12.45
    assert isinstance(first.timestamp, datetime)
    assert first.timestamp.tzinfo is None  # naive, see module comment
    assert second.close == 2168000.0


def test_parse_klines_json_empty_array_returns_empty_list():
    assert parse_klines_json("[]") == []


def test_parse_klines_json_wrong_length_inner_array_raises():
    with pytest.raises(TradeDataError):
        parse_klines_json('[[1722333600, "1.0", "2.0", "0.5", "1.5"]]')


def test_parse_klines_json_non_numeric_value_raises():
    with pytest.raises(TradeDataError):
        parse_klines_json(
            '[[1722333600, "not-a-number", "2.0", "0.5", "1.5", "1.0"]]'
        )


def test_parse_klines_json_non_list_top_level_raises():
    with pytest.raises(TradeDataError):
        parse_klines_json('{"not": "a list"}')


def test_parse_klines_json_invalid_json_raises():
    with pytest.raises(TradeDataError):
        parse_klines_json("not json at all")


def test_parse_klines_json_undecodable_bytes_raises():
    with pytest.raises(TradeDataError):
        parse_klines_json(b"\xff\xfe\x00\x00invalid")


# --- naive/aware datetime consistency fix ----------------------------------


def test_candle_timestamp_is_comparable_with_trade_record_buy_time():
    """Proves the naive/aware datetime fix: subtracting/comparing a
    Candle.timestamp against a TradeRecord.buy_time must NOT raise
    TypeError (which it would if one side were tz-aware and the other
    naive)."""
    candles = parse_klines_json('[[1722333600, "1.0", "1.0", "1.0", "1.0", "1.0"]]')
    candle = candles[0]

    record = TradeRecord(
        buy_time=datetime(2024, 7, 30, 10, 0, 0),
        sell_time=datetime(2024, 7, 31, 10, 0, 0),
        amount=100.0,
        is_stablecoin=False,
        buy_price=100.0,
        sell_price=110.0,
        currency="BTC",
    )

    # Must not raise TypeError.
    delta = candle.timestamp - record.buy_time
    assert delta.total_seconds() == 0.0
    assert not (candle.timestamp < record.buy_time)
    assert not (candle.timestamp > record.buy_time)


# --- calculate_chase_up_indices / calculate_metrics end-to-end ------------


def test_calculate_chase_up_indices_hand_computed_scenario():
    """Hand-crafted scenario with 2 currencies:
      - BTC has candle data + one buy-side TradeRecord.
      - ETH has NO candle data at all.

    Candle series for BTC (hourly, flat except one up-move):
      hour 0: close=100, hour 1: close=100, hour 2: close=110
    Buy fills (for MTI/Δt): two buys 1h apart -> MTI = 1.0h -> Δt tier
    is "MTI < 2h" -> scalper, Δt = 0.25h... but our two buy fills below
    are spaced exactly 3h apart to land MTI in the [2h, 24h) day-trader
    tier instead (Δt = 1.0h), matching the hourly candle granularity used
    here so the by-hand arithmetic stays simple.

    TradeRecord buy_time = hour 2 (close=110), Δt=1h before is hour 1
    (close=100). R = (110-100)/100 = 0.10, R+ = 0.10.
    Volatility: consecutive-candle returns are [ (100-100)/100,
    (110-100)/100 ] = [0.0, 0.10]. Sample stdev (M-1=1 divisor):
    mean=0.05, variance=((0-0.05)^2 + (0.10-0.05)^2)/1 = 0.005,
    stdev = sqrt(0.005) ~= 0.070710678, which is > epsilon (0.001).
    S = 0.10 / 0.070710678 ~= 1.414213562.
    Only one record with weight=amount, so CR_score = S ~= 1.414213562,
    rounded to 2dp -> 1.41.
    """
    base = datetime(2024, 1, 1, 0, 0, 0)

    btc_candles = [
        Candle(timestamp=base, open=100.0, high=100.0, low=100.0, close=100.0, volume=1.0),
        Candle(
            timestamp=base + timedelta(hours=1),
            open=100.0,
            high=100.0,
            low=100.0,
            close=100.0,
            volume=1.0,
        ),
        Candle(
            timestamp=base + timedelta(hours=2),
            open=100.0,
            high=110.0,
            low=100.0,
            close=110.0,
            volume=1.0,
        ),
    ]

    btc_buy_time = base + timedelta(hours=2)
    records = [
        TradeRecord(
            buy_time=btc_buy_time,
            sell_time=btc_buy_time + timedelta(hours=1),
            amount=500.0,
            is_stablecoin=False,
            buy_price=110.0,
            sell_price=120.0,
            currency="BTC",
        ),
        TradeRecord(
            buy_time=base,
            sell_time=base + timedelta(hours=1),
            amount=200.0,
            is_stablecoin=False,
            buy_price=1.0,
            sell_price=1.0,
            currency="ETH",
        ),
    ]

    fills = [
        RawFill(
            currency="BTC",
            quote_currency="TWD",
            side="buy",
            price=110.0,
            volume=1.0,
            timestamp=base,
        ),
        RawFill(
            currency="BTC",
            quote_currency="TWD",
            side="buy",
            price=110.0,
            volume=1.0,
            timestamp=base + timedelta(hours=3),
        ),
    ]

    klines_by_currency = {"BTC": btc_candles}  # no entry at all for ETH

    result = calculate_metrics(records, fills=fills, klines_by_currency=klines_by_currency)

    assert result.by_currency["BTC"].chase_up_index == pytest.approx(1.41)
    assert result.by_currency["ETH"].chase_up_index is None


def test_calculate_chase_up_indices_missing_klines_entry_returns_none():
    """A currency entirely absent from klines_by_currency gets
    chase_up_index=None (rather than raising)."""
    records_by_currency = {
        "BTC": [
            TradeRecord(
                buy_time=datetime(2024, 1, 1),
                sell_time=datetime(2024, 1, 2),
                amount=100.0,
                is_stablecoin=False,
                buy_price=100.0,
                sell_price=110.0,
                currency="BTC",
            )
        ]
    }
    result = calculate_chase_up_indices(
        records_by_currency,
        [datetime(2024, 1, 1), datetime(2024, 1, 1, 3)],
        {},
    )
    assert result == {"BTC": None}
