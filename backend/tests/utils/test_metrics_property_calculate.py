"""Property-based tests for calculate_metrics's formulas.

Each test independently re-derives the expected metric value using plain
Python loops (not the implementation's own code path) and compares it
against calculate_metrics's output. calculate_metrics returns a
MetricsResult with two sections:
  - overall: computed across ALL records regardless of currency
  - by_currency: computed per currency group, EXCLUDING any currency group
    whose first record (in input order) is a stablecoin (is_stablecoin is
    decided per-group by the first record only, matching the
    implementation's own grouping logic in calculate_metrics).
"""

from datetime import datetime, timedelta

from hypothesis import given, settings, strategies as st

from backend.src.utils.metrics import (
    Candle,
    RawFill,
    TradeRecord,
    calculate_metrics,
)

BASE_TIME = datetime(2023, 1, 1)

# --- Shared strategies -------------------------------------------------

# Prices are either exactly 0 (to exercise the buy_price==0 exclusion) or a
# "normal" positive value bounded away from zero. Values that are nonzero
# but extremely close to zero (subnormals, or tiny normals like 1e-300)
# would make (sell_price - buy_price) / buy_price overflow to +/-inf, which
# is not a realistic trade price and is unrelated to the formulas under
# test, so they are excluded here.
_price_strategy = st.one_of(
    st.just(0.0),
    st.floats(
        min_value=0.01,
        max_value=100000,
        allow_nan=False,
        allow_infinity=False,
        allow_subnormal=False,
    ),
)
_amount_strategy = st.floats(
    min_value=0, max_value=1000000, allow_nan=False, allow_infinity=False
)


@st.composite
def _trade_record_strategy(draw, min_holding_days=0, max_holding_days=365):
    """Builds a single TradeRecord with sell_time >= buy_time."""
    buy_offset_days = draw(st.integers(min_value=0, max_value=3650))
    holding_seconds = draw(
        st.integers(
            min_value=int(min_holding_days * 86400),
            max_value=int(max_holding_days * 86400),
        )
    )
    buy_time = BASE_TIME + timedelta(days=buy_offset_days)
    sell_time = buy_time + timedelta(seconds=holding_seconds)

    return TradeRecord(
        buy_time=buy_time,
        sell_time=sell_time,
        amount=draw(_amount_strategy),
        is_stablecoin=draw(st.booleans()),
        buy_price=draw(_price_strategy),
        sell_price=draw(_price_strategy),
        currency=draw(st.sampled_from(["BTC", "ETH", "SOL", "DOGE"])),
    )


_records_strategy = st.lists(_trade_record_strategy(), min_size=1, max_size=50)


def _group_by_currency(records):
    """Groups records by currency, preserving first-appearance order."""
    groups: dict = {}
    for record in records:
        groups.setdefault(record.currency, []).append(record)
    return groups


def _non_stablecoin_groups(records):
    """Currency -> records for groups expected to appear in by_currency
    (i.e. whose first record is NOT a stablecoin), matching
    calculate_metrics's own grouping logic."""
    groups = _group_by_currency(records)
    return {
        currency: group_records
        for currency, group_records in groups.items()
        if not group_records[0].is_stablecoin
    }


# --- 1. trading_frequency_per_day (overall) -----------------------------


@given(records=_records_strategy)
@settings(max_examples=100)
def test_trading_frequency_per_day(records):
    """**Validates: overall.trading_frequency_per_day formula**

    trading_frequency_per_day = count / max(days_between(min(buy_time),
    max(sell_time)), 1), computed across ALL records.
    """
    result = calculate_metrics(records)

    earliest_buy = None
    latest_sell = None
    for record in records:
        if earliest_buy is None or record.buy_time < earliest_buy:
            earliest_buy = record.buy_time
        if latest_sell is None or record.sell_time > latest_sell:
            latest_sell = record.sell_time

    days_span = (latest_sell - earliest_buy).total_seconds() / 86400
    divisor = days_span if days_span > 1 else 1
    expected = round(len(records) / divisor, 2)

    assert result.overall.trading_frequency_per_day == expected


# --- 2. stablecoin_ratio_pct (overall) -----------------------------------


@given(records=_records_strategy)
@settings(max_examples=100)
def test_stablecoin_ratio_pct(records):
    """**Validates: overall.stablecoin_ratio_pct formula**

    stablecoin_ratio_pct = sum(amount where is_stablecoin) / sum(amount) *
    100, or 0.0 if total amount is 0, computed across ALL records.
    """
    result = calculate_metrics(records)

    total = 0.0
    stablecoin_total = 0.0
    for record in records:
        total += record.amount
        if record.is_stablecoin:
            stablecoin_total += record.amount

    if total == 0:
        expected = 0.0
    else:
        expected = round(stablecoin_total / total * 100, 2)

    assert result.overall.stablecoin_ratio_pct == expected


# --- 3. chase_up_index (per currency), volume-weighted volatility-------
# --- normalized lookback-return score -----------------------------------

# Small, tightly-bounded strategy dedicated to the chase-up index test:
# a single currency's buy-side TradeRecords (only buy_time and amount
# matter for this formula) plus a synthetic linearly-increasing candle
# series (one candle per hour, price increases by a fixed step per hour)
# covering the whole span. Using a simple linear price path (rather than
# fully random OHLCV) keeps the "compute expected by hand" arithmetic in
# this test tractable while still exercising the real formula end-to-end
# through calculate_metrics's public API.
_CANDLE_STEP = 10.0  # price increases by this much every hour
_CANDLE_START_PRICE = 1000.0


@st.composite
def _chase_up_scenario_strategy(draw):
    """Builds (records, fills, klines_by_currency, currency) for a single
    non-stablecoin currency, where buy_time for every record falls within
    an hourly candle series starting at BASE_TIME and running for
    `hours_span` hours at a constant per-hour price increase of
    _CANDLE_STEP, so that P(t) and P(t-Δt) are always exactly resolvable
    (no missing-candle edge cases to special-case in the hand-computed
    expected value).
    """
    currency = draw(st.sampled_from(["BTC", "ETH", "SOL"]))
    hours_span = draw(st.integers(min_value=10, max_value=48))

    num_records = draw(st.integers(min_value=1, max_value=5))
    records = []
    fills = []
    for _ in range(num_records):
        # Buy at least 2 hours in (so a Δt=1h lookback always resolves)
        # and never exactly at the last candle (so it stays within range).
        buy_hour_offset = draw(st.integers(min_value=2, max_value=hours_span - 1))
        buy_time = BASE_TIME + timedelta(hours=buy_hour_offset)
        sell_time = buy_time + timedelta(hours=1)
        amount = draw(
            st.floats(
                min_value=1.0,
                max_value=1000.0,
                allow_nan=False,
                allow_infinity=False,
            )
        )
        records.append(
            TradeRecord(
                buy_time=buy_time,
                sell_time=sell_time,
                amount=amount,
                is_stablecoin=False,
                buy_price=100.0,
                sell_price=100.0,
                currency=currency,
            )
        )
        fills.append(
            RawFill(
                currency=currency,
                quote_currency="TWD",
                side="buy",
                price=100.0,
                volume=1.0,
                timestamp=buy_time,
            )
        )
    # 10 deterministic "background" buy fills, spaced exactly 3 hours
    # apart and placed far outside the candle series (hour offset 1000+)
    # so they can't interfere with the candle/price lookups above -- they
    # exist purely to pin the account-wide MTI calculation deterministically
    # into the [2h, 24h) day-trader tier (Δt = 1.0h), regardless of how the
    # (at most 5) record-associated buy fills above happen to be spaced.
    # Proof sketch: among the up to (num_records + 10) total gaps computed
    # by calculate_mti_hours, exactly 9 gaps are precisely 3.0h (from these
    # 10 evenly-spaced fills) while at most 6 gaps come from record spacing
    # + the one connecting gap; since 9 > 6, the 3.0h gaps always dominate
    # enough of the sorted list to force the median to land on 3.0h.
    for i in range(10):
        fills.append(
            RawFill(
                currency=currency,
                quote_currency="TWD",
                side="buy",
                price=100.0,
                volume=1.0,
                timestamp=BASE_TIME + timedelta(hours=1000 + i * 3),
            )
        )

    candles = [
        Candle(
            timestamp=BASE_TIME + timedelta(hours=hour),
            open=_CANDLE_START_PRICE + hour * _CANDLE_STEP,
            high=_CANDLE_START_PRICE + hour * _CANDLE_STEP,
            low=_CANDLE_START_PRICE + hour * _CANDLE_STEP,
            close=_CANDLE_START_PRICE + hour * _CANDLE_STEP,
            volume=1.0,
        )
        for hour in range(hours_span + 1)
    ]

    return records, fills, {currency: candles}, currency


@given(scenario=_chase_up_scenario_strategy())
@settings(max_examples=50)
def test_chase_up_index(scenario):
    """**Validates: by_currency[currency].chase_up_index formula**

    Independently (via a plain loop, not calling calculate_chase_up_indices
    or its helpers) computes:
      sigma_effective = max(sample_stdev(consecutive hourly returns), 0.001)
      for each record: R+ = max(0, (P(t) - P(t-1h)) / P(t-1h))
                       S = R+ / sigma_effective
      CR_score = sum(amount_i * S_i) / sum(amount_i)
    and asserts it matches calculate_metrics(...).by_currency[currency].chase_up_index.
    """
    records, fills, klines_by_currency, currency = scenario
    candles = klines_by_currency[currency]

    # Expected Δt is always 1.0h here (2+ buy fills, MTI falls in the
    # [2h, 24h) day-trader tier since consecutive buy fills are spaced
    # a few hours apart at most and at least 1h apart).
    prices_by_hour = {
        (candle.timestamp - BASE_TIME).total_seconds() / 3600: candle.close
        for candle in candles
    }

    returns = []
    sorted_hours = sorted(prices_by_hour.keys())
    for earlier_hour, later_hour in zip(sorted_hours[:-1], sorted_hours[1:]):
        earlier_price = prices_by_hour[earlier_hour]
        later_price = prices_by_hour[later_hour]
        returns.append((later_price - earlier_price) / earlier_price)

    mean_return = sum(returns) / len(returns)
    variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)
    sigma_effective = max(variance ** 0.5, 0.001)

    weighted_sum = 0.0
    total_weight = 0.0
    for record in records:
        buy_hour = (record.buy_time - BASE_TIME).total_seconds() / 3600
        price_at_t = prices_by_hour[buy_hour]
        price_at_t_minus_dt = prices_by_hour[buy_hour - 1.0]

        lookback_return = (price_at_t - price_at_t_minus_dt) / price_at_t_minus_dt
        lookback_return_positive = max(0.0, lookback_return)
        s_i = lookback_return_positive / sigma_effective

        weighted_sum += record.amount * s_i
        total_weight += record.amount

    expected = round(weighted_sum / total_weight, 2)

    result = calculate_metrics(records, fills=fills, klines_by_currency=klines_by_currency)

    assert result.by_currency[currency].chase_up_index == expected


# --- 4. return_pct-derived metrics: avg_stop_loss_pct, avg_return_pct, --
# --- return_std_dev (per currency), including buy_price == 0 exclusion --


@given(records=_records_strategy)
@settings(max_examples=100)
def test_return_pct_derived_metrics(records):
    """**Validates: by_currency[currency] avg_stop_loss_pct, avg_return_pct,
    return_std_dev formulas and buy_price==0 exclusion**

    Per non-stablecoin currency group, for records with buy_price != 0:
      return_pct = (sell_price - buy_price) / buy_price * 100
      avg_return_pct = mean(return_pct), or 0.0 if none remain
      avg_stop_loss_pct = abs(mean(negative return_pct)), or 0.0 if none
      return_std_dev = population stdev(return_pct), or 0.0 if < 2 remain
    """
    result = calculate_metrics(records)

    for currency, group_records in _non_stablecoin_groups(records).items():
        returns = []
        for record in group_records:
            if record.buy_price != 0:
                returns.append(
                    (record.sell_price - record.buy_price) / record.buy_price * 100
                )

        # avg_return_pct
        if returns:
            avg_return_expected = round(sum(returns) / len(returns), 2)
        else:
            avg_return_expected = 0.0

        # avg_stop_loss_pct: mean of negative return_pct values, independently
        # accumulated via a running total/count rather than a list comprehension
        # to exercise a different code path than the implementation.
        neg_total = 0.0
        neg_count = 0
        for value in returns:
            if value < 0:
                neg_total += value
                neg_count += 1
        if neg_count > 0:
            avg_stop_loss_expected = round(abs(neg_total / neg_count), 2)
        else:
            avg_stop_loss_expected = 0.0

        # return_std_dev: population standard deviation computed manually.
        if len(returns) >= 2:
            mean_value = sum(returns) / len(returns)
            variance = sum((v - mean_value) ** 2 for v in returns) / len(returns)
            std_dev_expected = round(variance ** 0.5, 2)
        else:
            std_dev_expected = 0.0

        currency_metrics = result.by_currency[currency]
        assert currency_metrics.avg_return_pct == avg_return_expected
        assert currency_metrics.avg_stop_loss_pct == avg_stop_loss_expected
        assert currency_metrics.return_std_dev == std_dev_expected


# --- 5. avg_holding_days (per currency) ----------------------------------


@given(records=_records_strategy)
@settings(max_examples=100)
def test_avg_holding_days(records):
    """**Validates: by_currency[currency].avg_holding_days formula**

    Per non-stablecoin currency group: avg_holding_days = mean of
    (sell_time - buy_time) in days across ALL of that group's records (not
    filtered by buy_price).
    """
    result = calculate_metrics(records)

    for currency, group_records in _non_stablecoin_groups(records).items():
        total_days = 0.0
        for record in group_records:
            delta_seconds = (record.sell_time - record.buy_time).total_seconds()
            total_days += delta_seconds / 86400

        expected = round(total_days / len(group_records), 2)

        assert result.by_currency[currency].avg_holding_days == expected
