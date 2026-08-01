"""Unit tests for the GET /market/trades Lambda handler."""

import json
from unittest.mock import patch

from src.handlers import market_trades
from src.services.max_api import MaxApiError


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def _trade(id_, price, volume, side, created_at_ms):
    return {"id": id_, "price": str(price), "volume": str(volume), "side": side, "created_at": created_at_ms}


def test_missing_currency_returns_400():
    resp = market_trades.lambda_handler(_event(), None)
    assert resp["statusCode"] == 400


def test_invalid_limit_returns_400():
    resp = market_trades.lambda_handler(_event(currency="BTC", limit="abc"), None)
    assert resp["statusCode"] == 400


def test_limit_out_of_range_returns_400():
    resp = market_trades.lambda_handler(_event(currency="BTC", limit="0"), None)
    assert resp["statusCode"] == 400
    resp2 = market_trades.lambda_handler(_event(currency="BTC", limit="1001"), None)
    assert resp2["statusCode"] == 400


@patch.object(market_trades.MaxApiClient, "get_trades")
def test_success_maps_bid_ask_to_buy_sell(mock_trades):
    mock_trades.return_value = [
        _trade(1, "2000000", "0.01", "bid", 1785600000123),
        _trade(2, "2001000", "0.02", "ask", 1785600001456),
    ]
    resp = market_trades.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["trades"][0] == {"price": 2000000.0, "volume": 0.01, "side": "buy", "timestamp": 1785600000}
    assert body["trades"][1]["side"] == "sell"


@patch.object(market_trades.MaxApiClient, "get_trades")
def test_malformed_trade_entries_skipped(mock_trades):
    mock_trades.return_value = [
        {"price": "not-a-number", "volume": "0.01", "side": "bid", "created_at": 1785600000000},
        _trade(2, "2000000", "0.01", "bid", 1785600000000),
        {"price": "2000000", "volume": "0.01", "side": "unknown", "created_at": 1785600000000},
    ]
    resp = market_trades.lambda_handler(_event(currency="BTC"), None)
    body = json.loads(resp["body"])
    assert len(body["trades"]) == 1


@patch.object(market_trades.MaxApiClient, "get_trades")
def test_max_api_error_returns_502(mock_trades):
    mock_trades.side_effect = MaxApiError("boom")
    resp = market_trades.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 502


@patch.object(market_trades.MaxApiClient, "get_trades")
def test_non_list_response_returns_502(mock_trades):
    mock_trades.return_value = {"unexpected": "shape"}
    resp = market_trades.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 502
