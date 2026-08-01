"""Unit tests for the GET /market/fund_flow Lambda handler.

MAX API calls are mocked so these tests run offline and deterministically.
The pagination logic in _fetch_trades_within_window() reads the wall clock
(time.time()) to compute the window cutoff, so tests build trade timestamps
relative to `time.time()` at call time rather than hardcoding absolute
epoch values (which would drift and break as time passes).
"""

import json
import time
from unittest.mock import patch

from src.handlers import market_fund_flow
from src.services.max_api import MaxApiError


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def _trade(id_, funds, side, created_at_ms):
    return {"id": id_, "price": "2000000", "volume": "0.01", "funds": str(funds), "side": side, "created_at": created_at_ms}


def test_missing_currency_returns_400():
    resp = market_fund_flow.lambda_handler(_event(), None)
    assert resp["statusCode"] == 400


def test_invalid_period_returns_400():
    resp = market_fund_flow.lambda_handler(_event(currency="BTC", period="1w"), None)
    assert resp["statusCode"] == 400


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_success_classifies_recent_trades(mock_trades, mock_klines):
    now_ms = int(time.time() * 1000)
    # First page has 2 recent trades; second page is empty (no more data),
    # which stops the pagination loop.
    mock_trades.side_effect = [
        [
            _trade(1, 50000, "bid", now_ms - 1000),
            _trade(2, 40000, "ask", now_ms - 2000),
        ],
        [],
    ]
    mock_klines.return_value = []

    resp = market_fund_flow.lambda_handler(_event(currency="BTC", period="1h"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["period"] == "1h"
    assert body["trade_count"] == 2
    assert body["buckets"]["medium"]["buy"] == 50000.0
    assert body["buckets"]["medium"]["sell"] == 40000.0
    assert body["net_inflow"] == 10000.0
    assert body["daily_net_flow"] == []


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_trades_outside_window_excluded(mock_trades, mock_klines):
    now_ms = int(time.time() * 1000)
    two_hours_ago_ms = now_ms - 2 * 60 * 60 * 1000
    mock_trades.return_value = [
        _trade(1, 50000, "bid", now_ms - 1000),        # within 1h window
        _trade(2, 40000, "ask", two_hours_ago_ms),      # outside 1h window
    ]
    mock_klines.return_value = []

    resp = market_fund_flow.lambda_handler(_event(currency="BTC", period="1h"), None)
    body = json.loads(resp["body"])
    assert body["trade_count"] == 1
    assert body["buckets"]["medium"]["sell"] == 0.0


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_first_page_failure_returns_502(mock_trades, mock_klines):
    mock_trades.side_effect = MaxApiError("boom")
    resp = market_fund_flow.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 502


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_pagination_stops_early_when_window_covered(mock_trades, mock_klines):
    """A single page of trades that already covers the requested window
    should not trigger a second API call."""
    now_ms = int(time.time() * 1000)
    old_enough_ms = now_ms - 2 * 60 * 60 * 1000  # older than 1h window
    mock_trades.return_value = [
        _trade(1, 50000, "bid", now_ms - 1000),
        _trade(2, 40000, "ask", old_enough_ms),
    ]
    mock_klines.return_value = []

    market_fund_flow.lambda_handler(_event(currency="BTC", period="1h"), None)
    assert mock_trades.call_count == 1


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_daily_net_flow_included_from_klines(mock_trades, mock_klines):
    mock_trades.return_value = []
    mock_klines.return_value = [
        [1700000000, "100", "110", "95", "105", "2.0"],
    ]
    resp = market_fund_flow.lambda_handler(_event(currency="BTC"), None)
    body = json.loads(resp["body"])
    assert body["daily_net_flow"] == [{"time": 1700000000, "net_flow": 210.0}]


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_kline_failure_is_best_effort_empty_list(mock_trades, mock_klines):
    mock_trades.return_value = []
    mock_klines.side_effect = MaxApiError("boom")
    resp = market_fund_flow.lambda_handler(_event(currency="BTC"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["daily_net_flow"] == []


@patch.object(market_fund_flow.MaxApiClient, "get_klines")
@patch.object(market_fund_flow.MaxApiClient, "get_trades")
def test_no_trades_returns_zeroed_buckets(mock_trades, mock_klines):
    mock_trades.return_value = []
    mock_klines.return_value = []
    resp = market_fund_flow.lambda_handler(_event(currency="BTC"), None)
    body = json.loads(resp["body"])
    assert body["trade_count"] == 0
    assert body["net_inflow"] == 0.0
