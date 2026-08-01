"""Unit tests for the GET /market/depth Lambda handler."""

import json
from unittest.mock import patch

from src.handlers import market_depth
from src.services.max_api import MaxApiError


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def test_missing_currency_returns_400():
    resp = market_depth.lambda_handler(_event(), None)
    assert resp["statusCode"] == 400
    assert "Access-Control-Allow-Origin" in resp["headers"]


def test_invalid_limit_returns_400():
    resp = market_depth.lambda_handler(_event(currency="BTC", limit="abc"), None)
    assert resp["statusCode"] == 400


def test_limit_out_of_range_returns_400():
    resp = market_depth.lambda_handler(_event(currency="BTC", limit="0"), None)
    assert resp["statusCode"] == 400
    resp2 = market_depth.lambda_handler(_event(currency="BTC", limit="301"), None)
    assert resp2["statusCode"] == 400


@patch.object(market_depth.MaxApiClient, "get_depth")
def test_success_coerces_string_price_volume_to_float(mock_depth):
    mock_depth.return_value = {
        "asks": [["2033000.5", "0.5"], ["2034000.0", "1.2"]],
        "bids": [["2031000.0", "0.6"]],
    }
    resp = market_depth.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["asks"] == [[2033000.5, 0.5], [2034000.0, 1.2]]
    assert body["bids"] == [[2031000.0, 0.6]]


@patch.object(market_depth.MaxApiClient, "get_depth")
def test_malformed_levels_skipped(mock_depth):
    mock_depth.return_value = {
        "asks": [["not-a-number", "0.5"], ["2034000.0", "1.2"]],
        "bids": "not-a-list",
    }
    resp = market_depth.lambda_handler(_event(currency="BTC"), None)
    body = json.loads(resp["body"])
    assert body["asks"] == [[2034000.0, 1.2]]
    assert body["bids"] == []


@patch.object(market_depth.MaxApiClient, "get_depth")
def test_max_api_error_returns_502(mock_depth):
    mock_depth.side_effect = MaxApiError("boom")
    resp = market_depth.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 502


@patch.object(market_depth.MaxApiClient, "get_depth")
def test_malformed_response_shape_returns_502(mock_depth):
    mock_depth.return_value = {"unexpected": "shape"}
    resp = market_depth.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 502


@patch.object(market_depth.MaxApiClient, "get_depth")
def test_market_built_from_currency_and_quote(mock_depth):
    mock_depth.return_value = {"asks": [], "bids": []}
    market_depth.lambda_handler(_event(currency="eth", quote="usdt"), None)
    mock_depth.assert_called_once()
    args, kwargs = mock_depth.call_args
    assert args[0] == "ethusdt" or kwargs.get("market") == "ethusdt"
