"""Unit tests for the 4-axis personality metrics module."""

import json
import pytest

from src.utils.metrics import (
    Candle,
    ClosedTrade,
    PersonalityScores,
    RawTrade,
    TradeDataError,
    calculate_emotion_score,
    calculate_frequency_score,
    calculate_personality,
    calculate_risk_score,
    calculate_strategy_score,
    compute_metrics_json,
    match_fifo_trades,
    parse_klines_json,
    parse_trades_csv,
)

_CSV_HEADER = "timestamp,currency,price,action,change,balance"


# ── parse_trades_csv ─────────────────────────────────────────────────────────

def test_parse_csv_valid():
    csv_text = "\n".join([
        _CSV_HEADER,
        "1700000000000,BTC,2000000,買,0.01,0.05",
        "1700100000000,BTC,2100000,賣,-0.005,0.045",
        "1700200000000,ETH,60000,充值,1.0,10.0",
    ])
    trades = parse_trades_csv(csv_text)
    assert len(trades) == 3
    assert trades[0].currency == "BTC"
    assert trades[0].action == "買"
    assert trades[1].action == "賣"
    assert trades[2].action == "充值"


def test_parse_csv_missing_header_raises():
    with pytest.raises(TradeDataError):
        parse_trades_csv("")


def test_parse_csv_missing_column_raises():
    with pytest.raises(TradeDataError):
        parse_trades_csv("timestamp,currency,price,action,change\n1700000000000,BTC,2000000,買,0.01")


def test_parse_csv_invalid_action_raises():
    with pytest.raises(TradeDataError):
        parse_trades_csv(f"{_CSV_HEADER}\n1700000000000,BTC,2000000,持有,0.01,0.05")


def test_parse_csv_header_only_returns_empty():
    assert parse_trades_csv(_CSV_HEADER + "\n") == []


# ── FIFO matching ────────────────────────────────────────────────────────────

def test_fifo_match_basic():
    trades = [
        RawTrade(1700000000000, "BTC", 2000000, "買", 0.01, 0.01),
        RawTrade(1700100000000, "BTC", 2100000, "買", 0.02, 0.03),
        RawTrade(1700200000000, "BTC", 2200000, "賣", -0.015, 0.015),
    ]
    closed = match_fifo_trades(trades)
    assert len(closed) == 2
    assert closed[0].buy_price == 2000000
    assert closed[0].volume == pytest.approx(0.01)
    assert closed[1].buy_price == 2100000
    assert closed[1].volume == pytest.approx(0.005)


def test_fifo_ignores_deposit_withdraw():
    trades = [
        RawTrade(1700000000000, "BTC", 2000000, "充值", 1.0, 1.0),
        RawTrade(1700100000000, "BTC", 2000000, "提領", -0.5, 0.5),
    ]
    assert match_fifo_trades(trades) == []


# ── Frequency score ──────────────────────────────────────────────────────────

def test_frequency_score_few_trades():
    trades = [RawTrade(1700000000000, "BTC", 2000000, "買", 0.01, 0.01)]
    assert calculate_frequency_score(trades)["f_score"] == 0.0


def test_frequency_score_high_frequency():
    base = 1700000000000
    trades = [
        RawTrade(base + i * 600_000, "BTC", 2000000, "買", 0.01, 0.01 * (i + 1))
        for i in range(20)
    ]
    assert calculate_frequency_score(trades)["f_score"] > 80.0


# ── Strategy score ───────────────────────────────────────────────────────────

def test_strategy_score_regular_trades():
    base = 1700000000000
    interval = 3_600_000
    trades = [
        RawTrade(base + i * interval, "BTC", 2000000, "買", 0.01, 0.01 * (i + 1))
        for i in range(10)
    ]
    trades += [
        RawTrade(base + (10 + i) * interval, "BTC", 1900000, "賣", -0.01, 0.01 * (9 - i))
        for i in range(5)
    ]
    assert calculate_strategy_score(trades)["s_score"] > 50.0


# ── End-to-end ───────────────────────────────────────────────────────────────

def test_compute_metrics_json_valid():
    csv_text = "\n".join([
        _CSV_HEADER,
        "1700000000000,BTC,2000000,買,0.01,0.01",
        "1700100000000,BTC,2100000,買,0.02,0.03",
        "1700200000000,BTC,2200000,賣,-0.015,0.015",
        "1700300000000,ETH,60000,買,1.0,1.0",
        "1700400000000,ETH,62000,賣,-0.5,0.5",
    ])
    parsed = json.loads(compute_metrics_json(csv_text))
    assert "error" not in parsed
    for key in ("r_score", "e_score", "f_score", "s_score"):
        assert 0 <= parsed[key] <= 100


def test_compute_metrics_json_empty_returns_error():
    parsed = json.loads(compute_metrics_json(_CSV_HEADER + "\n"))
    assert "error" in parsed


def test_compute_metrics_json_invalid_returns_error():
    parsed = json.loads(compute_metrics_json("garbage"))
    assert "error" in parsed


# ── parse_klines_json ────────────────────────────────────────────────────────

def test_parse_klines_json_valid():
    data = '[[1722333600, "2150000.0", "2160000.0", "2140000.0", "2155000.0", "12.45"]]'
    candles = parse_klines_json(data)
    assert len(candles) == 1
    assert candles[0].close == 2155000.0


def test_parse_klines_json_empty():
    assert parse_klines_json("[]") == []


def test_parse_klines_json_invalid_raises():
    with pytest.raises(TradeDataError):
        parse_klines_json("not json")
