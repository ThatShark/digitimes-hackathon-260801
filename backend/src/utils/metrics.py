"""Personality metrics computation module (16-type investor personality).

Computes 4-axis personality scores (R/E/F/S) from a user's trade history CSV:
  R — Risk:      Defensive (0) vs. Aggressive (100)
  E — Emotion:   Calm (0) vs. Emotional (100)
  F — Frequency: Long-term (0) vs. Short-term (100)
  S — Strategy:  Intuitive (0) vs. Quantitative (100)

CSV columns: timestamp (ms), currency, price (TWD), action, change, balance.
External data (K-line candles, volatility) is passed in by the caller.
This module performs no I/O.
"""

import csv
import io
import json
import math
import statistics
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional


class TradeDataError(Exception):
    """Raised on invalid or incomplete input data."""


# ═══════════════════════════════════════════════════════════════════════════════
# Data classes
# ═══════════════════════════════════════════════════════════════════════════════

_CSV_COLUMNS = ("timestamp", "currency", "price", "action", "change", "balance")

_BUY_ACTIONS = {"買"}
_SELL_ACTIONS = {"賣"}
_DEPOSIT_ACTIONS = {"充值"}
_WITHDRAW_ACTIONS = {"提領"}
_ALL_ACTIONS = _BUY_ACTIONS | _SELL_ACTIONS | _DEPOSIT_ACTIONS | _WITHDRAW_ACTIONS


@dataclass(frozen=True)
class RawTrade:
    """A single row from the trade CSV."""
    timestamp_ms: int
    currency: str
    price: float
    action: str
    change: float
    balance: float

    @property
    def timestamp_dt(self) -> datetime:
        return datetime.fromtimestamp(
            self.timestamp_ms / 1000.0, tz=timezone.utc
        ).replace(tzinfo=None)

    @property
    def amount_twd(self) -> float:
        return abs(self.change) * self.price


@dataclass(frozen=True)
class Candle:
    """A single K-line data point (naive UTC datetime)."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(frozen=True)
class PersonalityScores:
    """Final 4-axis personality result (each 0-100)."""
    r_score: float
    e_score: float
    f_score: float
    s_score: float
    r_s1_volatility: float
    r_s2_concentration: float
    r_s3_drawdown: float
    e_s1_fomo: float
    e_s2_revenge: float
    e_s3_impulsive: float
    f_mti_hours: float
    s_s1_regularity: float
    s_s2_discipline: float


# ═══════════════════════════════════════════════════════════════════════════════
# CSV Parsing
# ═══════════════════════════════════════════════════════════════════════════════

def parse_trades_csv(csv_content: "str | bytes") -> list[RawTrade]:
    """Parse CSV into list of RawTrade. Raises TradeDataError on bad input."""
    if isinstance(csv_content, bytes):
        try:
            text = csv_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise TradeDataError(f"Unable to decode CSV as UTF-8: {exc}") from exc
    else:
        text = csv_content

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames

    if fieldnames is None:
        raise TradeDataError("CSV content is missing a header row")

    missing = [c for c in _CSV_COLUMNS if c not in fieldnames]
    if missing:
        raise TradeDataError(f"CSV header missing required column(s): {', '.join(missing)}")

    trades: list[RawTrade] = []
    for row_num, row in enumerate(reader, start=1):
        try:
            timestamp_ms = int(row["timestamp"])
            currency = row["currency"].strip()
            price = float(row["price"])
            action = row["action"].strip()
            change = float(row["change"])
            balance = float(row["balance"])
        except (TypeError, ValueError, KeyError) as exc:
            raise TradeDataError(f"Row {row_num}: invalid field value — {exc}") from exc

        if action not in _ALL_ACTIONS:
            raise TradeDataError(f"Row {row_num}: unrecognized action '{action}'")

        trades.append(RawTrade(
            timestamp_ms=timestamp_ms, currency=currency, price=price,
            action=action, change=change, balance=balance,
        ))
    return trades


def parse_klines_json(json_content: "str | bytes") -> list[Candle]:
    """Parse K-line JSON: [[ts_sec, O, H, L, C, V], ...] -> list[Candle]."""
    if isinstance(json_content, bytes):
        try:
            text = json_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise TradeDataError(f"Unable to decode as UTF-8: {exc}") from exc
    else:
        text = json_content

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise TradeDataError(f"Invalid JSON: {exc}") from exc

    if not isinstance(parsed, list):
        raise TradeDataError("K-line JSON must be a top-level list")

    candles: list[Candle] = []
    for i, elem in enumerate(parsed, start=1):
        if not isinstance(elem, (list, tuple)) or len(elem) != 6:
            raise TradeDataError(f"Candle {i}: expected list of 6, got {elem!r}")
        try:
            ts = int(elem[0])
            o, h, l, c, v = (float(x) for x in elem[1:])
        except (TypeError, ValueError) as exc:
            raise TradeDataError(f"Candle {i}: non-numeric value — {exc}") from exc
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)
        candles.append(Candle(timestamp=dt, open=o, high=h, low=l, close=c, volume=v))
    return candles


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return min(hi, max(lo, value))


def _percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    n = len(sorted_values)
    k = (pct / 100.0) * (n - 1)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    return sorted_values[f] * (c - k) + sorted_values[c] * (k - f)


def _buy_sell_only(trades: list[RawTrade]) -> list[RawTrade]:
    return [t for t in trades if t.action in (_BUY_ACTIONS | _SELL_ACTIONS)]


def _buy_only(trades: list[RawTrade]) -> list[RawTrade]:
    return [t for t in trades if t.action in _BUY_ACTIONS]


# ═══════════════════════════════════════════════════════════════════════════════
# FIFO matching
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class _OpenLot:
    remaining: float
    price: float
    timestamp_ms: int


@dataclass(frozen=True)
class ClosedTrade:
    currency: str
    buy_price: float
    sell_price: float
    volume: float
    buy_time_ms: int
    sell_time_ms: int

    @property
    def pnl_pct(self) -> float:
        if self.buy_price == 0:
            return 0.0
        return (self.sell_price - self.buy_price) / self.buy_price

    @property
    def holding_hours(self) -> float:
        return (self.sell_time_ms - self.buy_time_ms) / 3_600_000.0


def match_fifo_trades(trades: list[RawTrade]) -> list[ClosedTrade]:
    """FIFO-match buy/sell into closed round-trips. Ignores deposit/withdraw."""
    by_currency: dict[str, list[RawTrade]] = {}
    for t in trades:
        by_currency.setdefault(t.currency, []).append(t)

    closed: list[ClosedTrade] = []
    for currency, group in by_currency.items():
        sorted_group = sorted(group, key=lambda t: t.timestamp_ms)
        open_lots: list[_OpenLot] = []
        for t in sorted_group:
            if t.action in _BUY_ACTIONS:
                open_lots.append(_OpenLot(abs(t.change), t.price, t.timestamp_ms))
            elif t.action in _SELL_ACTIONS:
                sell_vol = abs(t.change)
                while sell_vol > 1e-12 and open_lots:
                    lot = open_lots[0]
                    matched = min(lot.remaining, sell_vol)
                    closed.append(ClosedTrade(
                        currency=currency, buy_price=lot.price,
                        sell_price=t.price, volume=matched,
                        buy_time_ms=lot.timestamp_ms, sell_time_ms=t.timestamp_ms,
                    ))
                    lot.remaining -= matched
                    sell_vol -= matched
                    if lot.remaining < 1e-12:
                        open_lots.pop(0)
    return closed


# ═══════════════════════════════════════════════════════════════════════════════
# R — Risk (Defensive 0 vs. Aggressive 100)
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_risk_score(
    trades: list[RawTrade],
    volatility_by_currency: "dict[str, float] | None" = None,
    closed_trades: "list[ClosedTrade] | None" = None,
) -> dict[str, float]:
    # R1: Portfolio Volatility (40%)
    if volatility_by_currency:
        last_balance: dict[str, tuple[float, float]] = {}
        for t in trades:
            last_balance[t.currency] = (t.balance, t.price)
        total_value = sum(bal * price for bal, price in last_balance.values())
        if total_value > 0:
            weighted_vol = sum(
                (bal * price / total_value) * volatility_by_currency.get(cur, 0.0)
                for cur, (bal, price) in last_balance.items()
            )
            s1 = _clamp(weighted_vol * 100.0)
        else:
            s1 = 0.0
    else:
        s1 = 50.0

    # R2: Position Concentration P90 (35%)
    buys = _buy_only(trades)
    if buys:
        ratios: list[float] = []
        for t in buys:
            portfolio_approx = t.balance * t.price if t.balance > 0 else t.amount_twd
            if portfolio_approx > 0:
                ratios.append(min(t.amount_twd / portfolio_approx, 1.0))
        if ratios:
            ratios.sort()
            p90 = _percentile(ratios, 90)
            s2 = _clamp((p90 - 0.05) / (0.50 - 0.05) * 100.0)
        else:
            s2 = 0.0
    else:
        s2 = 0.0

    # R3: Drawdown Tolerance (25%)
    if closed_trades is None:
        closed_trades = match_fifo_trades(trades)
    losing = [ct.pnl_pct for ct in closed_trades if ct.pnl_pct < 0]
    avg_loss = abs(statistics.mean(losing)) if losing else 0.0
    lt = (avg_loss + avg_loss) / 2.0  # mirror realized as proxy for unrealized
    s3 = _clamp((lt - 0.05) / (0.50 - 0.05) * 100.0)

    r_score = (s1 * 0.40) + (s2 * 0.35) + (s3 * 0.25)
    return {"r_score": round(r_score, 2), "s1_volatility": round(s1, 2),
            "s2_concentration": round(s2, 2), "s3_drawdown": round(s3, 2)}


# ═══════════════════════════════════════════════════════════════════════════════
# E — Emotion (Calm 0 vs. Emotional 100)
# ═══════════════════════════════════════════════════════════════════════════════

_VOLATILITY_EPSILON = 0.001
_MTI_TIERS = ((2.0, 0.25), (24.0, 1.0), (168.0, 4.0), (float("inf"), 24.0))
_DEFAULT_DELTA_T_HOURS = 1.0


def _compute_mti_hours(timestamps_ms: list[int]) -> "float | None":
    if len(timestamps_ms) < 2:
        return None
    sorted_ts = sorted(timestamps_ms)
    gaps = []
    for i in range(1, len(sorted_ts)):
        diff_s = (sorted_ts[i] - sorted_ts[i - 1]) / 1000.0
        if diff_s >= 10:
            gaps.append(diff_s / 3600.0)
    return statistics.median(gaps) if gaps else None


def _determine_delta_t(mti: "float | None") -> float:
    if mti is None:
        return _DEFAULT_DELTA_T_HOURS
    for upper, dt in _MTI_TIERS:
        if mti < upper:
            return dt
    return _MTI_TIERS[-1][1]


def _chase_up_score(buy_trades: list[RawTrade], klines: "dict[str, list[Candle]]", delta_t_h: float) -> float:
    import bisect
    weighted_sum = 0.0
    total_weight = 0.0
    for currency, candles in klines.items():
        if not candles:
            continue
        candles_sorted = sorted(candles, key=lambda c: c.timestamp)
        timestamps = [c.timestamp for c in candles_sorted]
        returns = []
        for j in range(1, len(candles_sorted)):
            if candles_sorted[j - 1].close > 0:
                returns.append((candles_sorted[j].close - candles_sorted[j - 1].close) / candles_sorted[j - 1].close)
        sigma = max(statistics.stdev(returns) if len(returns) >= 2 else 0.0, _VOLATILITY_EPSILON)
        delta_t = timedelta(hours=delta_t_h)
        for t in buy_trades:
            if t.currency != currency:
                continue
            buy_dt = t.timestamp_dt
            idx = bisect.bisect_right(timestamps, buy_dt) - 1
            if idx < 0:
                continue
            p_t = candles_sorted[idx].close
            idx2 = bisect.bisect_right(timestamps, buy_dt - delta_t) - 1
            if idx2 < 0:
                continue
            p_prev = candles_sorted[idx2].close
            if p_prev <= 0:
                continue
            s_i = max(0.0, (p_t - p_prev) / p_prev) / sigma
            weighted_sum += t.amount_twd * s_i
            total_weight += t.amount_twd
    return weighted_sum / total_weight if total_weight > 0 else 0.0


def _revenge_factor(trades: list[RawTrade], closed: list[ClosedTrade]) -> tuple[float, bool]:
    buy_sell = _buy_sell_only(trades)
    if len(buy_sell) < 5:
        return 1.0, False
    major_losses = [ct for ct in closed if ct.pnl_pct <= -0.10]
    if not major_losses:
        return 1.0, False
    sorted_ts = sorted(t.timestamp_ms for t in buy_sell)
    span_days = max((sorted_ts[-1] - sorted_ts[0]) / 86_400_000.0, 1.0)
    baseline_amount = sum(t.amount_twd for t in buy_sell) / span_days
    baseline_count = len(buy_sell) / span_days
    if baseline_amount == 0 or baseline_count == 0:
        return 1.0, True
    max_f = 1.0
    for loss in major_losses:
        w_start = loss.sell_time_ms
        w_end = w_start + 86_400_000
        wt = [t for t in buy_sell if w_start < t.timestamp_ms <= w_end]
        if not wt:
            continue
        f = max(sum(t.amount_twd for t in wt) / baseline_amount, len(wt) / baseline_count)
        max_f = max(max_f, f)
    return max_f, True


def _extreme_impulse_rate(trades: list[RawTrade], klines: "dict[str, list[Candle]]") -> float:
    buy_sell = _buy_sell_only(trades)
    if not buy_sell:
        return 0.0
    total_vol = 0.0
    extreme_vol = 0.0
    for t in buy_sell:
        total_vol += t.amount_twd
        candles = klines.get(t.currency)
        if not candles:
            continue
        trade_dt = t.timestamp_dt
        best: "Candle | None" = None
        for c in candles:
            if c.timestamp <= trade_dt <= c.timestamp + timedelta(hours=1):
                best = c
                break
        if best is None or best.high <= best.low:
            continue
        r_i = _clamp((t.price - best.low) / (best.high - best.low), 0.0, 1.0)
        if (t.action in _BUY_ACTIONS and r_i >= 0.85) or (t.action in _SELL_ACTIONS and r_i <= 0.15):
            extreme_vol += t.amount_twd
    return extreme_vol / total_vol if total_vol > 0 else 0.0


def calculate_emotion_score(
    trades: list[RawTrade],
    klines_by_currency: "dict[str, list[Candle]] | None" = None,
    closed_trades: "list[ClosedTrade] | None" = None,
) -> dict[str, float]:
    if klines_by_currency is None:
        klines_by_currency = {}
    if closed_trades is None:
        closed_trades = match_fifo_trades(trades)

    all_ts = [t.timestamp_ms for t in _buy_sell_only(trades)]
    mti = _compute_mti_hours(all_ts)
    delta_t = _determine_delta_t(mti)

    buy_trades = _buy_only(trades)
    cr = _chase_up_score(buy_trades, klines_by_currency, delta_t) if buy_trades and klines_by_currency else 0.0
    s1 = _clamp((cr - 0.5) / (2.5 - 0.5) * 100.0)

    rf, has_loss = _revenge_factor(trades, closed_trades)
    s2 = _clamp((rf - 1.0) / (3.0 - 1.0) * 100.0) if has_loss else 0.0

    epr = _extreme_impulse_rate(trades, klines_by_currency)
    s3 = _clamp((epr - 0.10) / (0.60 - 0.10) * 100.0)

    e_score = (s1 * 0.35) + (s2 * 0.40) + (s3 * 0.25)
    return {"e_score": round(e_score, 2), "s1_fomo": round(s1, 2),
            "s2_revenge": round(s2, 2), "s3_impulsive": round(s3, 2)}


# ═══════════════════════════════════════════════════════════════════════════════
# F — Frequency (Long-term 0 vs. Short-term 100)
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_frequency_score(trades: list[RawTrade]) -> dict[str, float]:
    buy_sell = _buy_sell_only(trades)
    timestamps = sorted(t.timestamp_ms for t in buy_sell)
    if len(timestamps) < 2:
        return {"f_score": 0.0, "mti_hours": 720.0}
    gaps_hours = []
    for i in range(1, len(timestamps)):
        diff_s = (timestamps[i] - timestamps[i - 1]) / 1000.0
        if diff_s >= 10:
            gaps_hours.append(diff_s / 3600.0)
    if not gaps_hours:
        return {"f_score": 100.0, "mti_hours": 0.0}
    mti = statistics.median(gaps_hours)
    mti_min, mti_max = 5.0 / 60.0, 720.0
    if mti <= mti_min:
        f_score = 100.0
    elif mti >= mti_max:
        f_score = 0.0
    else:
        f_score = (math.log(mti_max) - math.log(mti)) / (math.log(mti_max) - math.log(mti_min)) * 100.0
    return {"f_score": round(_clamp(f_score), 2), "mti_hours": round(mti, 2)}


# ═══════════════════════════════════════════════════════════════════════════════
# S — Strategy (Intuitive 0 vs. Quantitative 100)
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_strategy_score(
    trades: list[RawTrade],
    closed_trades: "list[ClosedTrade] | None" = None,
) -> dict[str, float]:
    buy_sell = _buy_sell_only(trades)
    if len(buy_sell) < 3:
        s1 = 50.0
    else:
        amounts = [t.amount_twd for t in buy_sell if t.amount_twd > 0]
        sorted_ts = sorted(t.timestamp_ms for t in buy_sell)
        intervals = [(sorted_ts[i] - sorted_ts[i-1]) / 3_600_000.0
                     for i in range(1, len(sorted_ts)) if (sorted_ts[i] - sorted_ts[i-1]) >= 10_000]
        cv_a = (statistics.stdev(amounts) / statistics.mean(amounts)) if len(amounts) >= 2 and statistics.mean(amounts) > 0 else 2.0
        cv_i = (statistics.stdev(intervals) / statistics.mean(intervals)) if len(intervals) >= 2 and statistics.mean(intervals) > 0 else 2.0
        cv_avg = (cv_a + cv_i) / 2.0
        s1 = _clamp((2.0 - cv_avg) / (2.0 - 0.2) * 100.0)

    if closed_trades is None:
        closed_trades = match_fifo_trades(trades)
    losing_pnls = [ct.pnl_pct for ct in closed_trades if ct.pnl_pct < 0]
    sd_loss = statistics.stdev(losing_pnls) if len(losing_pnls) >= 2 else 0.03
    s2 = _clamp((0.20 - sd_loss) / (0.20 - 0.03) * 100.0)

    s_score = (s1 * 0.45) + (s2 * 0.55)
    return {"s_score": round(s_score, 2), "s1_regularity": round(s1, 2), "s2_discipline": round(s2, 2)}


# ═══════════════════════════════════════════════════════════════════════════════
# Main entry point
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_personality(
    trades: list[RawTrade],
    klines_by_currency: "dict[str, list[Candle]] | None" = None,
    volatility_by_currency: "dict[str, float] | None" = None,
) -> PersonalityScores:
    """Compute full 4-axis personality scores. Raises TradeDataError if empty."""
    if not trades:
        raise TradeDataError("No trade data found")
    if klines_by_currency is None:
        klines_by_currency = {}
    closed = match_fifo_trades(trades)
    r = calculate_risk_score(trades, volatility_by_currency, closed)
    e = calculate_emotion_score(trades, klines_by_currency, closed)
    f = calculate_frequency_score(trades)
    s = calculate_strategy_score(trades, closed)
    return PersonalityScores(
        r_score=r["r_score"], e_score=e["e_score"],
        f_score=f["f_score"], s_score=s["s_score"],
        r_s1_volatility=r["s1_volatility"], r_s2_concentration=r["s2_concentration"],
        r_s3_drawdown=r["s3_drawdown"], e_s1_fomo=e["s1_fomo"],
        e_s2_revenge=e["s2_revenge"], e_s3_impulsive=e["s3_impulsive"],
        f_mti_hours=f["mti_hours"], s_s1_regularity=s["s1_regularity"],
        s_s2_discipline=s["s2_discipline"],
    )


def serialize_personality(result: "PersonalityScores | TradeDataError") -> str:
    if isinstance(result, TradeDataError):
        return json.dumps({"error": str(result)}, ensure_ascii=False)
    if isinstance(result, PersonalityScores):
        return json.dumps(asdict(result), ensure_ascii=False)
    raise TypeError(f"Expected PersonalityScores or TradeDataError, got {type(result).__name__}")


def compute_metrics_json(
    content: "str | bytes",
    klines_by_currency: "dict[str, list[Candle]] | None" = None,
    volatility_by_currency: "dict[str, float] | None" = None,
    **_kwargs,
) -> str:
    """Entry point: CSV -> personality JSON. Never raises."""
    try:
        trades = parse_trades_csv(content)
        result = calculate_personality(trades, klines_by_currency, volatility_by_currency)
    except TradeDataError as exc:
        return serialize_personality(exc)
    return serialize_personality(result)
