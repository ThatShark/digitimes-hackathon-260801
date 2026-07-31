"""Trade metrics computation module.

Pure computation: parses a user's raw trade fill history, uploaded as a CSV
file with Chinese column headers (時間, 交易對, 類型, 價格, 數量, 總金額,
手續費, 手續費幣種), into FIFO-matched TradeRecord round-trips, computes a
set of quantitative trading metrics (MetricsResult, split into overall +
per-currency sections), and serializes the result to JSON. No AWS/S3
dependency, no I/O beyond in-memory strings/bytes (Requirement 5.3, 7.1).
"""

import bisect
import csv
import io
from collections import deque
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import json
import statistics


class TradeDataError(Exception):
    """Raised by parse_trades_csv, match_fifo_trades, or calculate_metrics
    on invalid or incomplete input."""


# All 8 documented CSV columns, and the subset actually required to
# construct a RawFill (總金額/手續費/手續費幣種 are ignored for computation,
# see parse_trades_csv's docstring for the header-strictness judgment call).
_CSV_ALL_COLUMNS = ("時間", "交易對", "類型", "價格", "數量", "總金額", "手續費", "手續費幣種")

# Marker key used to detect data rows with MORE fields than the header via
# csv.DictReader's restkey mechanism.
_CSV_EXTRA_FIELD_MARKER = "__extra_fields__"

# 類型 values that normalize to "buy" / "sell" respectively.
_BUY_SIDE_VALUES = {"買入"}
_SELL_SIDE_VALUES = {"賣出"}

# Currencies treated as stablecoins for is_stablecoin / stablecoin_ratio_pct.
_STABLECOIN_CURRENCIES = {"TWD", "USDT", "USDC"}

# --- Chase-up index (追漲指數) constants --------------------------------
#
# Naive-vs-aware datetime judgment call: TradeRecord.buy_time/sell_time
# (parsed from the CSV's 時間 column by _parse_created_at) are naive
# datetimes -- there is no timezone info in that data. Candle.timestamp
# below is derived from a true Unix epoch (K-line timestamp_seconds), so
# it is unambiguous UTC. To keep every datetime in this module mutually
# comparable/subtractable (required by calculate_chase_up_indices's price
# lookups, which subtract/compare Candle timestamps against TradeRecord
# buy_time), we convert the epoch to a NAIVE UTC wall-clock datetime
# (tzinfo stripped after conversion) rather than attaching tzinfo. This
# matches how the CSV times are already treated as naive throughout the
# module. Note: datetime.utcfromtimestamp() is deprecated since Python
# 3.12, so we use fromtimestamp(..., tz=timezone.utc) and then drop the
# tzinfo, which is equivalent but avoids the deprecation warning.
_NORMAL_VOLATILITY_WINDOW_DAYS = 30
_MTI_LOOKBACK_COUNT = 500
_VOLATILITY_EPSILON = 0.001

# (mti_upper_bound_hours_exclusive, delta_t_hours) tiers, checked in order.
# MTI < 2h -> scalper (0.25h); 2h <= MTI < 24h -> day trader (1h);
# 24h <= MTI < 168h -> swing trader (4h); MTI >= 168h -> HODLER/DCA (24h).
_MTI_CLASSIFICATION_TABLE = (
    (2.0, 0.25),
    (24.0, 1.0),
    (24.0 * 7, 4.0),
    (float("inf"), 24.0),
)

# Fallback Δt (hours) used when MTI cannot be computed (fewer than 2 buy
# fills exist). Defaults to the Day Trader tier -- a judgment call flagged
# to and accepted by the user, since there isn't enough history to infer
# an actual trading style yet.
_DEFAULT_DELTA_T_HOURS = 1.0


@dataclass(frozen=True)
class RawFill:
    currency: str
    quote_currency: str
    side: str
    price: float
    volume: float
    timestamp: datetime


@dataclass(frozen=True)
class TradeRecord:
    buy_time: datetime
    sell_time: datetime
    amount: float
    is_stablecoin: bool
    buy_price: float
    sell_price: float
    currency: str


@dataclass(frozen=True)
class Candle:
    """A single K-line (candlestick) data point. timestamp is a NAIVE
    UTC datetime (see module-level comment above _NORMAL_VOLATILITY_WINDOW_DAYS
    for why it is naive rather than timezone-aware -- this keeps it
    comparable/subtractable against TradeRecord.buy_time/sell_time, which
    are also naive)."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(frozen=True)
class OverallMetrics:
    trading_frequency_per_day: float
    stablecoin_ratio_pct: float


@dataclass(frozen=True)
class CurrencyMetrics:
    # Volume-weighted, volatility-normalized "chase-up index" (追漲指數):
    # CR_score = sum(V_i * S_i) / sum(V_i) across the currency's buy-side
    # records, where S_i is each buy's lookback return (relative to Δt
    # hours earlier) normalized by the currency's 30-day return volatility
    # at Δt granularity. This is a continuous score (NOT a percentage, no
    # upper bound in principle) -- higher means the user tends to buy
    # after larger, volatility-adjusted upward moves ("chasing the pump").
    # None if no K-line data was supplied for this currency, or if no
    # record's price data could be resolved from the supplied candles.
    chase_up_index: "float | None"
    avg_stop_loss_pct: float
    avg_holding_days: float
    avg_return_pct: float
    return_std_dev: float


@dataclass(frozen=True)
class MetricsResult:
    overall: OverallMetrics
    by_currency: "dict[str, CurrencyMetrics]"


def _normalize_side(raw_value: object, row_number: int) -> str:
    normalized = str(raw_value).strip()
    if normalized in _BUY_SIDE_VALUES:
        return "buy"
    if normalized in _SELL_SIDE_VALUES:
        return "sell"
    raise TradeDataError(
        f"Row {row_number} has an unrecognized '類型' value: {raw_value!r}"
    )


def _parse_numeric_field(raw_value: object, field_name: str, row_number: int) -> float:
    try:
        # 價格/數量 may contain thousands-separator commas per the field
        # spec (e.g. "2,150,000"), so strip them before converting.
        return float(str(raw_value).replace(",", ""))
    except (TypeError, ValueError) as exc:
        raise TradeDataError(
            f"Row {row_number} has an invalid value for field "
            f"'{field_name}': {raw_value!r}"
        ) from exc


def _parse_market_pair(raw_value: object, row_number: int) -> tuple[str, str]:
    if not isinstance(raw_value, str):
        raise TradeDataError(
            f"Row {row_number} has an invalid '交易對' value: {raw_value!r}"
        )
    parts = raw_value.split("/")
    if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
        raise TradeDataError(
            f"Row {row_number} has a '交易對' that does not split into "
            f"exactly two non-empty parts: {raw_value!r}"
        )
    return parts[0].strip(), parts[1].strip()


def _parse_created_at(raw_value: object, row_number: int) -> datetime:
    # The 時間 column is a naive "YYYY/MM/DD HH:MM:SS" string with no
    # explicit timezone offset in the data itself (even though it is
    # typically Taiwan time, UTC+8, by convention upstream). Parsed as a
    # naive datetime rather than attaching a timezone -- see task notes.
    try:
        return datetime.strptime(str(raw_value).strip(), "%Y/%m/%d %H:%M:%S")
    except (TypeError, ValueError) as exc:
        raise TradeDataError(
            f"Row {row_number} has an invalid '時間' value: {raw_value!r}"
        ) from exc


def parse_trades_csv(csv_content: "str | bytes") -> list[RawFill]:
    """Parses raw trade fill CSV content into a list of RawFill.

    Expects a header row with the exact documented Chinese columns:
    時間,交易對,類型,價格,數量,總金額,手續費,手續費幣種 (see module docstring).
    總金額/手續費/手續費幣種 are parsed but not used to construct RawFill
    (see task notes: matched amount is recomputed independently by
    match_fifo_trades, and fees are excluded from P&L entirely).

    Judgment call: the header must contain ALL 8 documented columns, not
    just the 5 required to build a RawFill (時間/交易對/類型/價格/數量).
    This is stricter than strictly necessary for computation, but matches
    "the documented format" as instructed; relax this later if partial
    headers (e.g. missing 總金額) should be tolerated instead.

    Row numbers in error messages are 1-indexed over DATA rows only (the
    header row itself is not counted, so the first data row is row 1).

    Raises TradeDataError on malformed input: undecodable bytes, missing
    required header column(s), a data row whose field count doesn't match
    the header's field count, or an unparsable field value (identifying
    the row number and column name). Returns [] for a header-only CSV
    (zero data rows).
    """
    if isinstance(csv_content, bytes):
        try:
            text = csv_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise TradeDataError(f"Unable to decode content as UTF-8: {exc}") from exc
    else:
        text = csv_content

    try:
        reader = csv.DictReader(
            io.StringIO(text), restkey=_CSV_EXTRA_FIELD_MARKER
        )
        fieldnames = reader.fieldnames
    except csv.Error as exc:
        raise TradeDataError(f"Unable to parse content as CSV: {exc}") from exc

    if fieldnames is None:
        # Completely empty content: no header at all.
        raise TradeDataError("CSV content is missing a header row")

    missing_columns = [
        column for column in _CSV_ALL_COLUMNS if column not in fieldnames
    ]
    if missing_columns:
        raise TradeDataError(
            "CSV header is missing required column(s): " + ", ".join(missing_columns)
        )

    fills: list[RawFill] = []
    try:
        rows = list(reader)
    except csv.Error as exc:
        raise TradeDataError(f"Unable to parse content as CSV: {exc}") from exc

    for offset, row in enumerate(rows):
        row_number = offset + 1  # 1-indexed over data rows, header excluded

        if _CSV_EXTRA_FIELD_MARKER in row or None in row.values():
            raise TradeDataError(
                f"Row {row_number} has a field count that does not match "
                f"the header's field count"
            )

        currency, quote_currency = _parse_market_pair(row["交易對"], row_number)
        side = _normalize_side(row["類型"], row_number)
        price = _parse_numeric_field(row["價格"], "價格", row_number)
        volume = _parse_numeric_field(row["數量"], "數量", row_number)
        timestamp = _parse_created_at(row["時間"], row_number)

        fills.append(
            RawFill(
                currency=currency,
                quote_currency=quote_currency,
                side=side,
                price=price,
                volume=volume,
                timestamp=timestamp,
            )
        )

    return fills


def parse_klines_json(json_content: "str | bytes") -> "list[Candle]":
    """Parses raw K-line (candlestick) JSON content into a list of Candle.

    Expects a top-level JSON array of arrays, each inner array exactly
    [timestamp_seconds, open, high, low, close, volume] (see module task
    notes for the documented format). OHLCV values may arrive as numeric
    strings or already-numeric; both are accepted. timestamp_seconds is
    always Unix seconds (no magnitude-based ms/s detection, unlike the CSV
    時間 column's ambiguity elsewhere) and is converted to a NAIVE UTC
    datetime (see the module-level comment above _NORMAL_VOLATILITY_WINDOW_DAYS
    for why naive rather than timezone-aware).

    Raises TradeDataError on: undecodable bytes, invalid JSON, a
    non-list top-level value, or any element that is not a list/tuple of
    exactly 6 items whose values can't be converted (timestamp to int,
    the rest to float) -- identifying the offending candle's 1-indexed
    position in the error message. Returns [] for an empty top-level
    array ([]).
    """
    if isinstance(json_content, bytes):
        try:
            text = json_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise TradeDataError(f"Unable to decode content as UTF-8: {exc}") from exc
    else:
        text = json_content

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise TradeDataError(f"Unable to parse content as JSON: {exc}") from exc

    if not isinstance(parsed, list):
        raise TradeDataError(
            f"K-line JSON content must be a top-level list, got {type(parsed).__name__}"
        )

    candles: list[Candle] = []
    for offset, element in enumerate(parsed):
        position = offset + 1  # 1-indexed

        if not isinstance(element, (list, tuple)) or len(element) != 6:
            raise TradeDataError(
                f"Candle {position} must be a list/tuple of exactly 6 items, "
                f"got {element!r}"
            )

        raw_timestamp, raw_open, raw_high, raw_low, raw_close, raw_volume = element

        try:
            timestamp_seconds = int(raw_timestamp)
        except (TypeError, ValueError) as exc:
            raise TradeDataError(
                f"Candle {position} has an invalid timestamp value: {raw_timestamp!r}"
            ) from exc

        try:
            open_price = float(raw_open)
            high_price = float(raw_high)
            low_price = float(raw_low)
            close_price = float(raw_close)
            volume = float(raw_volume)
        except (TypeError, ValueError) as exc:
            raise TradeDataError(
                f"Candle {position} has a non-numeric OHLCV value: {element!r}"
            ) from exc

        # Convert epoch seconds to a naive UTC datetime (tzinfo stripped
        # after conversion) -- see module-level comment for rationale.
        timestamp = datetime.fromtimestamp(
            timestamp_seconds, tz=timezone.utc
        ).replace(tzinfo=None)

        candles.append(
            Candle(
                timestamp=timestamp,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                volume=volume,
            )
        )

    return candles


def calculate_mti_hours(buy_timestamps: "list[datetime]") -> "float | None":
    """Median Trade Interval in hours, over the most recent 500 buy
    timestamps (across the whole account).

    Sorts ascending, takes the last _MTI_LOOKBACK_COUNT (most recent),
    computes consecutive gaps in hours, and returns statistics.median of
    those gaps. Returns None if fewer than 2 timestamps are provided (no
    interval can be computed from 0 or 1 timestamps).
    """
    if len(buy_timestamps) < 2:
        return None

    ordered = sorted(buy_timestamps)[-_MTI_LOOKBACK_COUNT:]

    gaps_hours = [
        (later - earlier).total_seconds() / 3600
        for earlier, later in zip(ordered[:-1], ordered[1:])
    ]

    return statistics.median(gaps_hours)


def determine_delta_t_hours(mti_hours: "float | None") -> float:
    """Maps MTI (hours) to the Δt lookback window (hours) per the
    trading-style classification table (_MTI_CLASSIFICATION_TABLE).

    Defaults to _DEFAULT_DELTA_T_HOURS (Day Trader, 1.0h) if mti_hours is
    None -- this is the judgment call for when fewer than 2 buy fills
    exist and MTI cannot be computed at all (see the constant's comment
    above and the module-level comment near _NORMAL_VOLATILITY_WINDOW_DAYS).
    """
    if mti_hours is None:
        return _DEFAULT_DELTA_T_HOURS

    for upper_bound, delta_t in _MTI_CLASSIFICATION_TABLE:
        if mti_hours < upper_bound:
            return delta_t

    # Unreachable: the table's last tier is (inf, ...), always matched.
    return _MTI_CLASSIFICATION_TABLE[-1][1]


def _compute_normal_volatility(candles_sorted_by_time: "list[Candle]") -> float:
    """Sample stdev (divide by M-1) of consecutive-candle close-to-close
    returns, floored at _VOLATILITY_EPSILON.

    Requires at least 2 return values (i.e. 3+ candles) to compute a
    meaningful sample stdev; returns _VOLATILITY_EPSILON directly if fewer
    are available.
    """
    if len(candles_sorted_by_time) < 3:
        return _VOLATILITY_EPSILON

    returns = []
    for earlier, later in zip(candles_sorted_by_time[:-1], candles_sorted_by_time[1:]):
        if earlier.close == 0:
            continue
        returns.append((later.close - earlier.close) / earlier.close)

    if len(returns) < 2:
        return _VOLATILITY_EPSILON

    sigma = statistics.stdev(returns)  # sample stdev, divides by (M-1)
    return max(sigma, _VOLATILITY_EPSILON)


def _find_price_at_or_before(
    candles_sorted_by_time: "list[Candle]", target_time: datetime
) -> "float | None":
    """Returns the close price of the latest candle with timestamp <=
    target_time, or None if no such candle exists (target_time is before
    all available candles, or the candle list is empty).
    """
    if not candles_sorted_by_time:
        return None

    timestamps = [candle.timestamp for candle in candles_sorted_by_time]
    # bisect_right gives the insertion point after any candles exactly at
    # target_time, so index-1 is the latest candle with timestamp <=
    # target_time.
    index = bisect.bisect_right(timestamps, target_time) - 1
    if index < 0:
        return None

    return candles_sorted_by_time[index].close


def calculate_chase_up_indices(
    records_by_currency: "dict[str, list[TradeRecord]]",
    buy_timestamps: "list[datetime]",
    klines_by_currency: "dict[str, list[Candle]]",
) -> "dict[str, float | None]":
    """For each currency in records_by_currency, computes the
    volume-weighted chase-up index (CR_score) using that currency's
    records and candle data.

    Δt is determined ONCE (globally, from buy_timestamps via MTI) and
    applied to all currencies -- Δt reflects the user's overall trading
    cadence, not a per-currency property.

    Returns None for a currency if:
      - klines_by_currency has no entry (or an empty list) for that
        currency, OR
      - after attempting price lookups for every record, zero records had
        both P(t) and P(t-Δt) resolvable from the candle data (i.e. total
        weight is 0).

    Records with unresolvable P(t) or P(t-Δt) (e.g. buy_time falls outside
    the supplied candle coverage), or with P(t-Δt) == 0 (division-by-zero
    guard, mirroring the buy_price==0 exclusion pattern used elsewhere in
    this module), are silently excluded from that currency's weighted
    average (both numerator and denominator) rather than causing an
    error -- partial candle coverage degrades gracefully.
    """
    mti_hours = calculate_mti_hours(buy_timestamps)
    delta_t_hours = determine_delta_t_hours(mti_hours)
    delta_t = timedelta(hours=delta_t_hours)

    results: "dict[str, float | None]" = {}

    for currency, records in records_by_currency.items():
        candles = klines_by_currency.get(currency)
        if not candles:
            results[currency] = None
            continue

        candles_sorted = sorted(candles, key=lambda candle: candle.timestamp)
        sigma_effective = _compute_normal_volatility(candles_sorted)

        weighted_sum = 0.0
        total_weight = 0.0

        for record in records:
            price_at_t = _find_price_at_or_before(candles_sorted, record.buy_time)
            price_at_t_minus_dt = _find_price_at_or_before(
                candles_sorted, record.buy_time - delta_t
            )

            if price_at_t is None or price_at_t_minus_dt is None:
                continue
            if price_at_t_minus_dt == 0:
                continue

            lookback_return = (price_at_t - price_at_t_minus_dt) / price_at_t_minus_dt
            lookback_return_positive = max(0.0, lookback_return)
            chase_intensity = lookback_return_positive / sigma_effective

            weight = record.amount
            weighted_sum += weight * chase_intensity
            total_weight += weight

        if total_weight == 0:
            results[currency] = None
        else:
            results[currency] = round(weighted_sum / total_weight, 2)

    return results


@dataclass
class _OpenLot:
    remaining_volume: float
    price: float
    timestamp: datetime


def match_fifo_trades(fills: list[RawFill]) -> list[TradeRecord]:
    """Matches raw buy/sell fills into closed round-trip TradeRecords via FIFO.

    Groups fills by currency (base asset), and within each currency group
    matches sell volume against the earliest still-open buy lots first.
    Only closed round-trips are emitted; any buy volume left unmatched at
    the end (an open position) does not produce a TradeRecord. Raises
    TradeDataError if a sell fill's volume cannot be fully matched against
    prior buy fills for that currency (incomplete fill history).
    """
    # Group fill original indices by currency, preserving input order.
    indices_by_currency: dict[str, list[int]] = {}
    for index, fill in enumerate(fills):
        indices_by_currency.setdefault(fill.currency, []).append(index)

    records: list[TradeRecord] = []

    for currency in sorted(indices_by_currency.keys()):
        indices = indices_by_currency[currency]
        # Sort chronologically, tie-break by original input order/index.
        ordered_indices = sorted(indices, key=lambda i: (fills[i].timestamp, i))

        open_lots: deque[_OpenLot] = deque()

        for index in ordered_indices:
            fill = fills[index]

            if fill.side == "buy":
                open_lots.append(
                    _OpenLot(
                        remaining_volume=fill.volume,
                        price=fill.price,
                        timestamp=fill.timestamp,
                    )
                )
                continue

            # side == "sell"
            unmatched_sell_volume = fill.volume
            while unmatched_sell_volume > 0:
                if not open_lots:
                    raise TradeDataError(
                        f"Sell of {unmatched_sell_volume} {currency} could not be "
                        f"matched to any prior buy fill (fill history is likely "
                        f"incomplete for this currency)"
                    )

                lot = open_lots[0]
                matched_volume = min(lot.remaining_volume, unmatched_sell_volume)

                records.append(
                    TradeRecord(
                        buy_time=lot.timestamp,
                        sell_time=fill.timestamp,
                        amount=matched_volume * lot.price,
                        currency=currency,
                        is_stablecoin=currency.upper() in _STABLECOIN_CURRENCIES,
                        buy_price=lot.price,
                        sell_price=fill.price,
                    )
                )

                lot.remaining_volume -= matched_volume
                unmatched_sell_volume -= matched_volume
                if lot.remaining_volume <= 0:
                    open_lots.popleft()

    return records


def calculate_metrics(
    records: "list[TradeRecord]",
    fills: "list[RawFill] | None" = None,
    klines_by_currency: "dict[str, list[Candle]] | None" = None,
) -> MetricsResult:
    """Computes overall + per-currency MetricsResult from TradeRecord entries.

    Raises TradeDataError if records is empty.

    chase_up_index (per currency) requires cross-cutting data beyond a
    single currency's own records: the account-wide buy timestamps (to
    determine Δt via MTI) and K-line candle data (to resolve prices at
    buy time and Δt earlier). If BOTH fills and klines_by_currency are
    provided, buy-side timestamps are extracted from fills and
    calculate_chase_up_indices computes a real chase_up_index per
    currency. If either is None (the default), every currency's
    chase_up_index is None -- this is the case for the existing CSV-only
    compute_metrics_json pipeline, which has no K-line data source; see
    that function's docstring/comment for confirmation this is expected,
    not a bug.
    """
    if not records:
        raise TradeDataError("No trade data found")

    overall = _calculate_overall_metrics(records)

    records_by_currency: dict[str, list[TradeRecord]] = {}
    for record in records:
        records_by_currency.setdefault(record.currency, []).append(record)

    non_stablecoin_groups: dict[str, list[TradeRecord]] = {
        currency: currency_records
        for currency, currency_records in records_by_currency.items()
        # Stablecoin groups (TWD/USDT/USDC) are excluded from by_currency:
        # their contribution is already captured via overall's
        # stablecoin_ratio_pct.
        if not currency_records[0].is_stablecoin
    }

    chase_up_indices: "dict[str, float | None]"
    if fills is not None and klines_by_currency is not None:
        buy_timestamps = [fill.timestamp for fill in fills if fill.side == "buy"]
        chase_up_indices = calculate_chase_up_indices(
            non_stablecoin_groups, buy_timestamps, klines_by_currency
        )
    else:
        chase_up_indices = {currency: None for currency in non_stablecoin_groups}

    by_currency: dict[str, CurrencyMetrics] = {
        currency: _calculate_currency_metrics(
            currency_records, chase_up_indices.get(currency)
        )
        for currency, currency_records in non_stablecoin_groups.items()
    }

    return MetricsResult(overall=overall, by_currency=by_currency)


def _calculate_overall_metrics(records: list[TradeRecord]) -> OverallMetrics:
    count = len(records)

    # --- trading_frequency_per_day ---
    earliest_buy = min(record.buy_time for record in records)
    latest_sell = max(record.sell_time for record in records)
    days_span = (latest_sell - earliest_buy).total_seconds() / 86400
    frequency_divisor = max(days_span, 1)
    trading_frequency_per_day = count / frequency_divisor

    # --- stablecoin_ratio_pct ---
    total_amount = sum(record.amount for record in records)
    if total_amount == 0:
        stablecoin_ratio_pct = 0.0
    else:
        stablecoin_amount = sum(
            record.amount for record in records if record.is_stablecoin
        )
        stablecoin_ratio_pct = stablecoin_amount / total_amount * 100

    return OverallMetrics(
        trading_frequency_per_day=round(trading_frequency_per_day, 2),
        stablecoin_ratio_pct=round(stablecoin_ratio_pct, 2),
    )


def _calculate_currency_metrics(
    records: "list[TradeRecord]", chase_up_index: "float | None"
) -> CurrencyMetrics:
    count = len(records)

    # chase_up_index is now computed cross-cuttingly (needs account-wide
    # fills + K-line candle data) by calculate_chase_up_indices and passed
    # in by calculate_metrics -- this function no longer computes it
    # itself, since a single currency's records alone are insufficient.

    # --- avg_holding_days: mean across ALL records in the group ---
    holding_days = [
        (record.sell_time - record.buy_time).total_seconds() / 86400
        for record in records
    ]
    avg_holding_days = sum(holding_days) / count

    # --- return_pct derived metrics, excluding buy_price == 0 ---
    return_pcts = [
        (record.sell_price - record.buy_price) / record.buy_price * 100
        for record in records
        if record.buy_price != 0
    ]

    if return_pcts:
        avg_return_pct = sum(return_pcts) / len(return_pcts)
    else:
        avg_return_pct = 0.0

    negative_returns = [value for value in return_pcts if value < 0]
    if negative_returns:
        avg_stop_loss_pct = abs(sum(negative_returns) / len(negative_returns))
    else:
        avg_stop_loss_pct = 0.0

    if len(return_pcts) < 2:
        return_std_dev = 0.0
    else:
        return_std_dev = statistics.pstdev(return_pcts)

    return CurrencyMetrics(
        chase_up_index=chase_up_index,
        avg_stop_loss_pct=round(avg_stop_loss_pct, 2),
        avg_holding_days=round(avg_holding_days, 2),
        avg_return_pct=round(avg_return_pct, 2),
        return_std_dev=round(return_std_dev, 2),
    )


def serialize_metrics(result: "MetricsResult | TradeDataError") -> str:
    """Converts a MetricsResult or a TradeDataError into a JSON string.

    Produces {"overall": {...}, "by_currency": {"<CURRENCY>": {...}, ...}}
    when given a MetricsResult, or a single-field {"error": "..."} JSON
    object when given a TradeDataError. The output is UTF-8-safe (non-ASCII
    characters are preserved rather than escaped).
    """
    if isinstance(result, TradeDataError):
        payload = {"error": str(result)}
    elif isinstance(result, MetricsResult):
        payload = {
            "overall": asdict(result.overall),
            "by_currency": {
                currency: asdict(currency_metrics)
                for currency, currency_metrics in result.by_currency.items()
            },
        }
    else:
        raise TypeError(
            "serialize_metrics expects a MetricsResult or TradeDataError, "
            f"got {type(result).__name__}"
        )

    return json.dumps(payload, ensure_ascii=False)


def compute_metrics_json(content: "str | bytes") -> str:
    """Entry point. Orchestrates parse_trades_csv -> match_fifo_trades ->
    calculate_metrics -> serialize_metrics.

    Accepts raw trade fill CSV content as a str or bytes (bytes are
    decoded as UTF-8) without requiring a file path. Never raises: any
    TradeDataError raised along the pipeline is caught internally and
    routed through serialize_metrics as an error result.
    """
    if isinstance(content, bytes):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            return serialize_metrics(
                TradeDataError(f"Unable to decode content as UTF-8: {exc}")
            )
    else:
        text = content

    try:
        fills = parse_trades_csv(text)
        records = match_fifo_trades(fills)
        # CSV-only pipeline: no K-line data source is available here, so
        # calculate_metrics is called with its fills/klines_by_currency
        # defaults (None, None), meaning every currency's chase_up_index
        # will be None in the output. This is expected/correct for this
        # entry point, not a bug -- a future service layer that fetches
        # K-line data can call calculate_metrics directly with fills=fills
        # and klines_by_currency=... to get real chase_up_index values.
        result = calculate_metrics(records)
    except TradeDataError as exc:
        return serialize_metrics(exc)

    return serialize_metrics(result)
