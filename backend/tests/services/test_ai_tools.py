"""Unit tests for src/services/ai_tools.py's tool specs + dispatcher.

MAX/CMC/fund-flow calls are mocked so these tests run offline and
deterministically. See ai_chat.py's docstring for how the full multi-round
loop was manually smoke-tested against the real deployed Bedrock model.
"""

from unittest.mock import patch

import pytest

from src.services import ai_tools
from src.services.coinmarketcap import CoinMarketCapError
from src.services.max_api import MaxApiError


# ── build_tool_config ─────────────────────────────────────────────────────────

def test_no_currency_only_offers_fear_greed_tool():
    config = ai_tools.build_tool_config(None)
    names = [t["toolSpec"]["name"] for t in config["tools"]]
    assert names == [ai_tools.TOOL_GET_FEAR_GREED_INDEX]


def test_with_currency_offers_all_five_tools():
    config = ai_tools.build_tool_config("BTC")
    names = {t["toolSpec"]["name"] for t in config["tools"]}
    assert names == {
        ai_tools.TOOL_GET_FEAR_GREED_INDEX,
        ai_tools.TOOL_GET_CURRENT_PRICE,
        ai_tools.TOOL_GET_FUND_FLOW_ANALYSIS,
        ai_tools.TOOL_GET_TECHNICAL_INDICATORS,
        ai_tools.TOOL_PROPOSE_TRADE,
    }


def test_propose_trade_schema_requires_amount_twd_not_amount():
    config = ai_tools.build_tool_config("BTC")
    propose_trade_spec = next(
        t["toolSpec"] for t in config["tools"] if t["toolSpec"]["name"] == ai_tools.TOOL_PROPOSE_TRADE
    )
    schema = propose_trade_spec["inputSchema"]["json"]
    assert "amount_twd" in schema["properties"]
    assert "amount" not in schema["properties"]
    assert set(schema["required"]) == {"action", "amount_twd", "reason"}


# ── execute_tool: get_current_price ──────────────────────────────────────────

@patch.object(ai_tools.MaxApiClient, "get_ticker")
def test_get_current_price_success(mock_ticker):
    mock_ticker.return_value = {"last": "2000000", "open": "1950000", "high": "2050000", "low": "1900000", "vol": "10"}
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_CURRENT_PRICE, {}, "BTC")
    assert result["currency"] == "BTC"
    assert result["last_price_twd"] == 2000000.0
    assert result["change_24h_pct"] == pytest.approx(2.56, abs=0.01)


def test_get_current_price_no_currency_returns_error():
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_CURRENT_PRICE, {}, None)
    assert "error" in result


@patch.object(ai_tools.MaxApiClient, "get_ticker")
def test_get_current_price_api_failure_returns_error_not_raise(mock_ticker):
    mock_ticker.side_effect = MaxApiError("boom")
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_CURRENT_PRICE, {}, "BTC")
    assert "error" in result


# ── execute_tool: get_fear_greed_index ───────────────────────────────────────

@patch.object(ai_tools.CoinMarketCapClient, "get_fear_greed_latest")
def test_get_fear_greed_index_success(mock_fg):
    mock_fg.return_value = {"data": {"value": 22, "value_classification": "Extreme Fear", "update_time": "2026-01-01"}}
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_FEAR_GREED_INDEX, {}, "BTC")
    assert result["value"] == 22
    assert result["classification"] == "Extreme Fear"


@patch.object(ai_tools.CoinMarketCapClient, "get_fear_greed_latest")
def test_get_fear_greed_index_api_failure_returns_error(mock_fg):
    mock_fg.side_effect = CoinMarketCapError("boom")
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_FEAR_GREED_INDEX, {}, "BTC")
    assert "error" in result


# ── execute_tool: get_fund_flow_analysis ─────────────────────────────────────

@patch.object(ai_tools, "get_fund_flow_data")
def test_get_fund_flow_analysis_success(mock_get_data):
    mock_get_data.return_value = {"period": "1h", "buckets": {}, "net_inflow": 0.0, "trade_count": 0, "daily_net_flow": []}
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_FUND_FLOW_ANALYSIS, {"period": "1h"}, "BTC")
    assert result["period"] == "1h"
    mock_get_data.assert_called_once_with("BTC", "TWD", "1h")


@patch.object(ai_tools, "get_fund_flow_data")
def test_get_fund_flow_analysis_defaults_to_1h(mock_get_data):
    mock_get_data.return_value = {}
    ai_tools.execute_tool(ai_tools.TOOL_GET_FUND_FLOW_ANALYSIS, {}, "BTC")
    mock_get_data.assert_called_once_with("BTC", "TWD", "1h")


@patch.object(ai_tools, "get_fund_flow_data")
def test_get_fund_flow_analysis_invalid_period_falls_back_to_1h(mock_get_data):
    mock_get_data.return_value = {}
    ai_tools.execute_tool(ai_tools.TOOL_GET_FUND_FLOW_ANALYSIS, {"period": "1w"}, "BTC")
    mock_get_data.assert_called_once_with("BTC", "TWD", "1h")


def test_get_fund_flow_analysis_no_currency_returns_error():
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_FUND_FLOW_ANALYSIS, {}, None)
    assert "error" in result


# ── execute_tool: propose_trade + unknown tool ───────────────────────────────

def test_propose_trade_passthrough():
    tool_input = {"action": "buy", "amount_twd": 5000, "reason": "test reason"}
    result = ai_tools.execute_tool(ai_tools.TOOL_PROPOSE_TRADE, tool_input, "BTC")
    assert result == tool_input


def test_unknown_tool_name_returns_error():
    result = ai_tools.execute_tool("nonexistent_tool", {}, "BTC")
    assert "error" in result


def test_execute_tool_never_raises_on_unexpected_exception():
    """A malformed tool_input (e.g. wrong type) inside a tool implementation
    must be caught and returned as {"error": ...}, not propagate."""
    result = ai_tools.execute_tool(ai_tools.TOOL_GET_FUND_FLOW_ANALYSIS, "not-a-dict", "BTC")
    assert "error" in result
