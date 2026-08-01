"""Unit tests for the GET /notifications Lambda handler.

CoinMarketCap calls are mocked so these tests run offline and
deterministically — no real network calls. The mock whale_alert /
social_buzz notifications are deterministic (seeded by the current hour),
so tests only assert their *presence* and *type*, not exact text.
"""

import json
from unittest.mock import patch

from src.handlers import notifications
from src.services.coinmarketcap import CoinMarketCapError


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def _quote_list(percent_change_24h):
    """Mimics CMC keyless listings' quote shape: a LIST of per-currency
    dicts (not a dict keyed by currency code)."""
    return [{"symbol": "USD", "percent_change_24h": percent_change_24h}]


def _types(body):
    return [n["type"] for n in body["notifications"]]


# ── Validation ────────────────────────────────────────────────────────────────

def test_invalid_threshold_returns_400():
    resp = notifications.lambda_handler(_event(price_change_threshold="999"), None)
    assert resp["statusCode"] == 400
    assert "Access-Control-Allow-Origin" in resp["headers"]


def test_non_numeric_threshold_returns_400():
    resp = notifications.lambda_handler(_event(price_change_threshold="abc"), None)
    assert resp["statusCode"] == 400


def test_invalid_limit_returns_400():
    resp = notifications.lambda_handler(_event(limit="0"), None)
    assert resp["statusCode"] == 400


def test_limit_out_of_range_returns_400():
    resp = notifications.lambda_handler(_event(limit="21"), None)
    assert resp["statusCode"] == 400


# ── Happy path: price_mover from real (mocked) CMC listings data ─────────────

@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_price_mover_included_when_above_threshold(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {
        "data": [
            {"symbol": "PEPE", "quote": _quote_list(15.2)},
            {"symbol": "BTC", "quote": _quote_list(1.0)},  # below default 10% threshold
        ]
    }

    resp = notifications.lambda_handler(_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"

    movers = [n for n in body["notifications"] if n["type"] == "price_mover"]
    assert len(movers) == 1
    assert "PEPE" in movers[0]["text"]
    assert "+15.2%" in movers[0]["text"]
    assert movers[0]["icon"] == "📈"


@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_price_mover_negative_change_uses_down_icon(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {"data": [{"symbol": "ETH", "quote": _quote_list(-12.5)}]}

    resp = notifications.lambda_handler(_event(), None)
    body = json.loads(resp["body"])
    movers = [n for n in body["notifications"] if n["type"] == "price_mover"]
    assert len(movers) == 1
    assert movers[0]["icon"] == "📉"
    assert "跌幅" in movers[0]["text"]
    assert "-12.5%" in movers[0]["text"]


@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_threshold_boundary_is_inclusive(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {"data": [{"symbol": "SOL", "quote": _quote_list(10.0)}]}

    resp = notifications.lambda_handler(_event(price_change_threshold="10"), None)
    body = json.loads(resp["body"])
    movers = [n for n in body["notifications"] if n["type"] == "price_mover"]
    assert len(movers) == 1


@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_custom_threshold_filters_out_small_moves(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {"data": [{"symbol": "BTC", "quote": _quote_list(3.0)}]}

    resp = notifications.lambda_handler(_event(price_change_threshold="5"), None)
    body = json.loads(resp["body"])
    movers = [n for n in body["notifications"] if n["type"] == "price_mover"]
    assert movers == []


@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_multiple_movers_sorted_by_magnitude_descending(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {
        "data": [
            {"symbol": "A", "quote": _quote_list(12.0)},
            {"symbol": "B", "quote": _quote_list(-30.0)},
            {"symbol": "C", "quote": _quote_list(20.0)},
        ]
    }

    resp = notifications.lambda_handler(_event(), None)
    body = json.loads(resp["body"])
    movers = [n for n in body["notifications"] if n["type"] == "price_mover"]
    symbols_in_order = [m["text"].split()[0] for m in movers]
    assert symbols_in_order == ["B", "C", "A"]


# ── Happy path: fear_greed from real (mocked) CMC data ───────────────────────

@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_fear_greed_low_value_suggests_entry(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 22, "value_classification": "Extreme Fear"}}
    mock_listings.return_value = {"data": []}

    resp = notifications.lambda_handler(_event(), None)
    body = json.loads(resp["body"])
    fg = [n for n in body["notifications"] if n["type"] == "fear_greed"]
    assert len(fg) == 1
    assert "22" in fg[0]["text"]
    assert "極度恐慌" in fg[0]["text"]
    assert "進場" in fg[0]["text"]


@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_fear_greed_high_value_suggests_exit(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 82, "value_classification": "Extreme Greed"}}
    mock_listings.return_value = {"data": []}

    resp = notifications.lambda_handler(_event(), None)
    body = json.loads(resp["body"])
    fg = [n for n in body["notifications"] if n["type"] == "fear_greed"]
    assert len(fg) == 1
    assert "出場" in fg[0]["text"]


# ── Mock notification types are always present regardless of CMC outcome ────

@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_mock_types_always_present_on_success(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {"data": []}

    resp = notifications.lambda_handler(_event(), None)
    body = json.loads(resp["body"])
    assert "whale_alert" in _types(body)
    assert "social_buzz" in _types(body)


@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_all_cmc_sources_fail_still_returns_200_with_mock_notifications(mock_fg, mock_listings):
    """Unlike market_overview.py's 502-on-total-failure, /notifications
    always returns 200 — a missing real alert isn't worth erroring the
    whole banner over, and the frontend already falls back to its own
    mock strings on any failure anyway."""
    mock_fg.side_effect = CoinMarketCapError("boom")
    mock_listings.side_effect = CoinMarketCapError("boom")

    resp = notifications.lambda_handler(_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    types = _types(body)
    assert "price_mover" not in types
    assert "fear_greed" not in types
    assert "whale_alert" in types
    assert "social_buzz" in types


# ── Listings parsing quirks (keyless quote-is-a-list shape) ──────────────────

@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_entries_missing_usd_quote_are_skipped(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {
        "data": [
            {"symbol": "GOOD", "quote": _quote_list(20.0)},
            {"symbol": "NOQUOTE", "quote": []},  # no USD entry -> skipped
            {"symbol": "MALFORMED", "quote": "not-a-list"},  # wrong type -> skipped
        ]
    }

    resp = notifications.lambda_handler(_event(), None)
    body = json.loads(resp["body"])
    movers = [n for n in body["notifications"] if n["type"] == "price_mover"]
    assert len(movers) == 1
    assert "GOOD" in movers[0]["text"]


# ── limit trims the combined notification list ───────────────────────────────

@patch.object(notifications.CoinMarketCapClient, "get_listings")
@patch.object(notifications.CoinMarketCapClient, "get_fear_greed_latest")
def test_limit_trims_total_notifications(mock_fg, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_listings.return_value = {
        "data": [
            {"symbol": "A", "quote": _quote_list(50.0)},
            {"symbol": "B", "quote": _quote_list(40.0)},
            {"symbol": "C", "quote": _quote_list(30.0)},
        ]
    }

    resp = notifications.lambda_handler(_event(limit="2"), None)
    body = json.loads(resp["body"])
    assert len(body["notifications"]) == 2
