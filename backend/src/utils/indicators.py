"""Technical indicator calculations for AI chat context.

Pure functions — no I/O. Input is a list of candles (list of lists from MAX API:
[timestamp, open, high, low, close, volume]) and output is a dict summarizing
the latest indicator values suitable for feeding to Bedrock as tool results.

Implements:
  - MA (Simple Moving Average) — 7, 25, 99 periods
  - EMA (Exponential Moving Average) — 12, 26 periods
  - MACD (12, 26, 9)
  - RSI (14)
  - Bollinger Bands (20, 2)
  - KDJ / Stochastic (9, 3, 3)

All functions expect candles sorted ascending by time (oldest first), which is
how MAX API returns them.
"""

from __future__ import annotations


def compute_indicators(candles: list[list], periods: dict | None = None) -> dict:
    """Compute all indicators from raw MAX K-line candles.

    Args:
        candles: List of [timestamp, open, high, low, close, volume] lists.
        periods: Optional overrides for indicator periods.

    Returns:
        Dict with latest values for each indicator, ready for JSON serialization.
    """
    if not candles or len(candles) < 26:
        return {"error": "K 線數據不足，至少需要 26 根 K 棒才能計算技術指標"}

    closes = [float(c[4]) for c in candles]
    highs = [float(c[2]) for c in candles]
    lows = [float(c[3]) for c in candles]

    result = {}

    # ── Moving Averages ───────────────────────────────────────────────────────
    ma7 = _sma(closes, 7)
    ma25 = _sma(closes, 25)
    ma99 = _sma(closes, 99)

    result["ma"] = {
        "ma7": round(ma7, 2) if ma7 is not None else None,
        "ma25": round(ma25, 2) if ma25 is not None else None,
        "ma99": round(ma99, 2) if ma99 is not None else None,
        "trend": _ma_trend(ma7, ma25, ma99),
    }

    # ── MACD (12, 26, 9) ─────────────────────────────────────────────────────
    macd_line, signal_line, histogram = _macd(closes, 12, 26, 9)
    result["macd"] = {
        "macd_line": round(macd_line, 2) if macd_line is not None else None,
        "signal_line": round(signal_line, 2) if signal_line is not None else None,
        "histogram": round(histogram, 2) if histogram is not None else None,
        "signal": _macd_signal(macd_line, signal_line, histogram),
    }

    # ── RSI (14) ──────────────────────────────────────────────────────────────
    rsi = _rsi(closes, 14)
    result["rsi"] = {
        "value": round(rsi, 2) if rsi is not None else None,
        "signal": _rsi_signal(rsi),
    }

    # ── Bollinger Bands (20, 2) ───────────────────────────────────────────────
    upper, middle, lower = _bollinger(closes, 20, 2)
    current_price = closes[-1]
    result["bollinger"] = {
        "upper": round(upper, 2) if upper is not None else None,
        "middle": round(middle, 2) if middle is not None else None,
        "lower": round(lower, 2) if lower is not None else None,
        "current_price": round(current_price, 2),
        "position": _boll_position(current_price, upper, lower),
    }

    # ── KDJ / Stochastic (9, 3, 3) ───────────────────────────────────────────
    k_val, d_val, j_val = _kdj(highs, lows, closes, 9, 3, 3)
    result["kdj"] = {
        "k": round(k_val, 2) if k_val is not None else None,
        "d": round(d_val, 2) if d_val is not None else None,
        "j": round(j_val, 2) if j_val is not None else None,
        "signal": _kdj_signal(k_val, d_val, j_val),
    }

    # ── Summary for AI ────────────────────────────────────────────────────────
    result["summary"] = _build_summary(result)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Core calculations
# ─────────────────────────────────────────────────────────────────────────────

def _sma(values: list[float], period: int) -> float | None:
    """Simple Moving Average — latest value only."""
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def _ema_series(values: list[float], period: int) -> list[float]:
    """Full EMA series (same length as input, early values are approximate)."""
    if not values:
        return []
    k = 2.0 / (period + 1)
    ema = [values[0]]
    for i in range(1, len(values)):
        ema.append(values[i] * k + ema[-1] * (1 - k))
    return ema


def _macd(
    closes: list[float], fast: int = 12, slow: int = 26, signal_period: int = 9
) -> tuple[float | None, float | None, float | None]:
    """MACD — returns (macd_line, signal_line, histogram) latest values."""
    if len(closes) < slow + signal_period:
        return None, None, None

    ema_fast = _ema_series(closes, fast)
    ema_slow = _ema_series(closes, slow)

    macd_values = [ema_fast[i] - ema_slow[i] for i in range(len(closes))]
    signal_values = _ema_series(macd_values[slow - 1:], signal_period)

    if not signal_values:
        return macd_values[-1], None, None

    macd_line = macd_values[-1]
    signal_line = signal_values[-1]
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _rsi(closes: list[float], period: int = 14) -> float | None:
    """RSI (Wilder's smoothing) — latest value."""
    if len(closes) < period + 1:
        return None

    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))

    # Initial average
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    # Wilder's smoothing
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _bollinger(
    closes: list[float], period: int = 20, mult: float = 2.0
) -> tuple[float | None, float | None, float | None]:
    """Bollinger Bands — returns (upper, middle, lower) latest values."""
    if len(closes) < period:
        return None, None, None

    window = closes[-period:]
    middle = sum(window) / period
    variance = sum((x - middle) ** 2 for x in window) / period
    std = variance ** 0.5

    upper = middle + mult * std
    lower = middle - mult * std
    return upper, middle, lower


def _kdj(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    k_period: int = 9,
    d_period: int = 3,
    j_smooth: int = 3,
) -> tuple[float | None, float | None, float | None]:
    """KDJ / Stochastic oscillator — returns (K, D, J) latest values."""
    if len(closes) < k_period:
        return None, None, None

    # Calculate RSV series
    rsv_series = []
    for i in range(k_period - 1, len(closes)):
        window_high = max(highs[i - k_period + 1: i + 1])
        window_low = min(lows[i - k_period + 1: i + 1])
        if window_high == window_low:
            rsv_series.append(50.0)
        else:
            rsv_series.append((closes[i] - window_low) / (window_high - window_low) * 100.0)

    # Smooth K and D
    k_val = 50.0
    d_val = 50.0
    for rsv in rsv_series:
        k_val = (2.0 / d_period) * rsv + (1.0 - 2.0 / d_period) * k_val
        d_val = (2.0 / d_period) * k_val + (1.0 - 2.0 / d_period) * d_val

    j_val = 3.0 * k_val - 2.0 * d_val
    return k_val, d_val, j_val


# ─────────────────────────────────────────────────────────────────────────────
# Signal interpretation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ma_trend(ma7: float | None, ma25: float | None, ma99: float | None) -> str:
    """Interpret MA alignment."""
    if ma7 is None or ma25 is None:
        return "資料不足"
    if ma7 > ma25:
        if ma99 is not None and ma25 > ma99:
            return "多頭排列（短>中>長）— 強勢上漲趨勢"
        return "短期偏多（MA7 > MA25）"
    else:
        if ma99 is not None and ma25 < ma99:
            return "空頭排列（短<中<長）— 下跌趨勢"
        return "短期偏空（MA7 < MA25）"


def _macd_signal(macd_line: float | None, signal_line: float | None, histogram: float | None) -> str:
    if macd_line is None or signal_line is None:
        return "資料不足"
    if histogram is not None and histogram > 0 and macd_line > 0:
        return "多頭動能增強（MACD 在零軸上方且柱狀體為正）"
    if histogram is not None and histogram < 0 and macd_line < 0:
        return "空頭動能增強（MACD 在零軸下方且柱狀體為負）"
    if macd_line > signal_line:
        return "MACD 金叉（買入訊號）"
    if macd_line < signal_line:
        return "MACD 死叉（賣出訊號）"
    return "中性"


def _rsi_signal(rsi: float | None) -> str:
    if rsi is None:
        return "資料不足"
    if rsi >= 80:
        return "嚴重超買（RSI≥80）— 短期回調風險極高"
    if rsi >= 70:
        return "超買（RSI≥70）— 注意回調風險"
    if rsi <= 20:
        return "嚴重超賣（RSI≤20）— 可能是抄底機會"
    if rsi <= 30:
        return "超賣（RSI≤30）— 可能接近底部"
    if rsi >= 50:
        return "偏強（RSI 50-70）"
    return "偏弱（RSI 30-50）"


def _boll_position(price: float, upper: float | None, lower: float | None) -> str:
    if upper is None or lower is None:
        return "資料不足"
    band_width = upper - lower
    if band_width == 0:
        return "中性"
    if price >= upper:
        return "突破上軌 — 可能超漲或突破行情"
    if price <= lower:
        return "跌破下軌 — 可能超跌或破位"
    # Position as percentage within the band
    pct = (price - lower) / band_width * 100
    if pct >= 75:
        return f"接近上軌（位置 {pct:.0f}%）— 偏強但留意壓力"
    if pct <= 25:
        return f"接近下軌（位置 {pct:.0f}%）— 偏弱但可能有支撐"
    return f"中軌附近（位置 {pct:.0f}%）— 方向未明"


def _kdj_signal(k: float | None, d: float | None, j: float | None) -> str:
    if k is None or d is None:
        return "資料不足"
    if j is not None and j > 100:
        return "嚴重超買（J>100）— 短期過熱"
    if j is not None and j < 0:
        return "嚴重超賣（J<0）— 短期超跌"
    if k > 80 and d > 80:
        return "超買區（K、D 皆>80）"
    if k < 20 and d < 20:
        return "超賣區（K、D 皆<20）"
    if k > d:
        return "KDJ 金叉（K>D）— 偏多"
    return "KDJ 死叉（K<D）— 偏空"


def _build_summary(indicators: dict) -> str:
    """Build a one-paragraph summary of all indicators for AI context."""
    parts = []

    ma = indicators.get("ma", {})
    if ma.get("trend"):
        parts.append(f"均線: {ma['trend']}")

    macd = indicators.get("macd", {})
    if macd.get("signal"):
        parts.append(f"MACD: {macd['signal']}")

    rsi = indicators.get("rsi", {})
    if rsi.get("value") is not None:
        parts.append(f"RSI({rsi['value']}): {rsi['signal']}")

    boll = indicators.get("bollinger", {})
    if boll.get("position"):
        parts.append(f"布林帶: {boll['position']}")

    kdj = indicators.get("kdj", {})
    if kdj.get("signal"):
        parts.append(f"KDJ: {kdj['signal']}")

    return "；".join(parts) if parts else "無法生成摘要"
