"""Unit tests for the GET /market/overview Lambda handler.

CoinMarketCap calls are mocked so these tests run offline and
deterministically — no real network calls.
"""

import json
from unittest.mock import patch

from src.handlers import market_overview
from src.services.coinmarketcap import CoinMarketCapError


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def _quote_list(percent_change_24h):
    """Mimics CMC keyless listings' quote shape: a LIST of per-currency
    dicts (not a dict keyed by currency code)."""
    return [{"symbol": "USD", "percent_change_24h": percent_change_24h}]


# ── Validation ────────────────────────────────────────────────────────────────

def test_invalid_top_n_returns_400():
    resp = market_overview.lambda_handler(_event(top_n="0"), None)
    assert resp["statusCode"] == 400


def test_top_n_out_of_range_returns_400():
    resp = market_overview.lambda_handler(_event(top_n="21"), None)
    assert resp["statusCode"] == 400


def test_non_numeric_top_n_returns_400():
    resp = market_overview.lambda_handler(_event(top_n="abc"), None)
    assert resp["statusCode"] == 400


# ── Happy path ────────────────────────────────────────────────────────────────

@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_success_returns_all_fields(mock_fg, mock_global, mock_listings):
    mock_fg.return_value = {"data": {"value": 38, "value_classification": "Fear"}}
    mock_global.return_value = {
        "data": {
            "btc_dominance": 58.2,
            "quote": {"USD": {"total_market_cap": 3.12e12, "total_volume_24h": 9.85e10}},
        }
    }
    mock_listings.return_value = {
        "data": [
            {"symbol": "DOGE", "quote": _quote_list(15.2)},
            {"symbol": "ETH", "quote": _quote_list(-1.2)},
            {"symbol": "SOL", "quote": _quote_list(5.7)},
        ]
    }

    resp = market_overview.lambda_handler(_event(top_n="2"), None)
    assert resp["statusCode"] == 200
    assert resp["headers"]["Access-Control-Allow-Origin"] == "*"

    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["fear_greed"] == {"value": 38, "label": "Fear"}
    assert body["btc_dominance"] == 58.2
    assert body["total_market_cap"] == 3.12e12
    assert body["volume_24h"] == 9.85e10
    assert body["top_gainers"] == [
        {"symbol": "DOGE", "change_24h": 15.2},
        {"symbol": "SOL", "change_24h": 5.7},
    ]
    assert body["top_losers"] == [
        {"symbol": "ETH", "change_24h": -1.2},
        {"symbol": "SOL", "change_24h": 5.7},
    ]


# ── Partial failure degrades gracefully (per-field, not whole-request) ───────

@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_fear_greed_failure_still_returns_other_fields(mock_fg, mock_global, mock_listings):
    mock_fg.side_effect = CoinMarketCapError("boom")
    mock_global.return_value = {
        "data": {
            "btc_dominance": 58.2,
            "quote": {"USD": {"total_market_cap": 3.12e12, "total_volume_24h": 9.85e10}},
        }
    }
    mock_listings.return_value = {"data": [{"symbol": "BTC", "quote": _quote_list(1.0)}]}

    resp = market_overview.lambda_handler(_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["fear_greed"] is None
    assert body["btc_dominance"] == 58.2


@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_listings_failure_yields_empty_movers_not_whole_error(mock_fg, mock_global, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_global.return_value = {
        "data": {"btc_dominance": 58.2, "quote": {"USD": {"total_market_cap": 1.0, "total_volume_24h": 1.0}}}
    }
    mock_listings.side_effect = CoinMarketCapError("boom")

    resp = market_overview.lambda_handler(_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["top_gainers"] == []
    assert body["top_losers"] == []


@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_all_sources_fail_returns_502(mock_fg, mock_global, mock_listings):
    mock_fg.side_effect = CoinMarketCapError("boom")
    mock_global.side_effect = CoinMarketCapError("boom")
    mock_listings.side_effect = CoinMarketCapError("boom")

    resp = market_overview.lambda_handler(_event(), None)
    assert resp["statusCode"] == 502
    assert "Access-Control-Allow-Origin" in resp["headers"]


# ── Listings parsing quirks (keyless quote-is-a-list shape) ──────────────────

@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_entries_missing_usd_quote_are_skipped(mock_fg, mock_global, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_global.return_value = {
        "data": {"btc_dominance": 1.0, "quote": {"USD": {"total_market_cap": 1.0, "total_volume_24h": 1.0}}}
    }
    mock_listings.return_value = {
        "data": [
            {"symbol": "BTC", "quote": _quote_list(3.0)},
            {"symbol": "NOQUOTE", "quote": []},  # no USD entry -> skipped
            {"symbol": "MALFORMED", "quote": "not-a-list"},  # wrong type -> skipped
        ]
    }

    resp = market_overview.lambda_handler(_event(top_n="5"), None)
    body = json.loads(resp["body"])
    assert body["top_gainers"] == [{"symbol": "BTC", "change_24h": 3.0}]
    assert body["top_losers"] == [{"symbol": "BTC", "change_24h": 3.0}]


# ── Currency restriction: only the 6 supported coins (minus stablecoins) ────

@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_unsupported_currencies_excluded_from_movers(mock_fg, mock_global, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_global.return_value = {
        "data": {"btc_dominance": 1.0, "quote": {"USD": {"total_market_cap": 1.0, "total_volume_24h": 1.0}}}
    }
    mock_listings.return_value = {
        "data": [
            {"symbol": "PEPE", "quote": _quote_list(50.0)},  # not one of the 6 supported coins
            {"symbol": "ADA", "quote": _quote_list(40.0)},   # not one of the 6 supported coins
            {"symbol": "BTC", "quote": _quote_list(1.0)},
        ]
    }

    resp = market_overview.lambda_handler(_event(top_n="5"), None)
    body = json.loads(resp["body"])
    assert body["top_gainers"] == [{"symbol": "BTC", "change_24h": 1.0}]
    assert body["top_losers"] == [{"symbol": "BTC", "change_24h": 1.0}]


@patch.object(market_overview.CoinMarketCapClient, "get_listings")
@patch.object(market_overview.CoinMarketCapClient, "get_global_metrics")
@patch.object(market_overview.CoinMarketCapClient, "get_fear_greed_latest")
def test_stablecoins_excluded_from_movers(mock_fg, mock_global, mock_listings):
    mock_fg.return_value = {"data": {"value": 50, "value_classification": "Neutral"}}
    mock_global.return_value = {
        "data": {"btc_dominance": 1.0, "quote": {"USD": {"total_market_cap": 1.0, "total_volume_24h": 1.0}}}
    }
    mock_listings.return_value = {
        "data": [
            {"symbol": "USDT", "quote": _quote_list(0.01)},
            {"symbol": "USDC", "quote": _quote_list(-0.02)},
            {"symbol": "SOL", "quote": _quote_list(2.0)},
        ]
    }

    resp = market_overview.lambda_handler(_event(top_n="5"), None)
    body = json.loads(resp["body"])
    assert body["top_gainers"] == [{"symbol": "SOL", "change_24h": 2.0}]
    assert body["top_losers"] == [{"symbol": "SOL", "change_24h": 2.0}]
