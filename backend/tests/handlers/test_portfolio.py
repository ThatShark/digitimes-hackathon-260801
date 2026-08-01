"""Unit tests for the GET /portfolio Lambda handler."""

import json
from unittest.mock import patch

from src.handlers import portfolio
from src.services.max_api import MaxApiError
from src.services.s3_storage import S3StorageError

_CSV = (
    "timestamp,currency,price,action,change,balance\n"
    "1700000000000,BTC,2000000,buy,0.02,0.02\n"
    "1700100000000,BTC,2100000,sell,-0.005,0.015\n"
    "1700200000000,ETH,60000,buy,0.5,0.5\n"
)


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def test_missing_user_id_returns_400():
    resp = portfolio.lambda_handler({"queryStringParameters": {}}, None)
    assert resp["statusCode"] == 400


@patch.object(portfolio.S3StorageService, "get_trades_csv")
def test_no_csv_returns_404_need_csv(mock_get):
    mock_get.side_effect = S3StorageError("not found")
    resp = portfolio.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert body["status"] == "need_csv"


@patch.object(portfolio.MaxApiClient, "get_ticker")
@patch.object(portfolio.S3StorageService, "get_trades_csv")
def test_holdings_priced_and_totaled(mock_get_csv, mock_ticker):
    mock_get_csv.return_value = _CSV.encode()
    mock_ticker.side_effect = lambda market: (
        {"last": "2200000"} if market.startswith("btc") else {"last": "65000"}
    )

    resp = portfolio.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    currencies = {h["currency"] for h in body["holdings"]}
    assert currencies == {"BTC", "ETH"}
    btc = next(h for h in body["holdings"] if h["currency"] == "BTC")
    assert btc["quantity"] == 0.015
    assert btc["avg_cost"] == 2000000
    assert btc["current_price"] == 2200000.0
    assert btc["value"] == 33000.0
    assert body["total_value"] == 33000.0 + 0.5 * 65000.0


@patch.object(portfolio.MaxApiClient, "get_ticker")
@patch.object(portfolio.S3StorageService, "get_trades_csv")
def test_failed_price_lookup_omits_holding_not_whole_request(mock_get_csv, mock_ticker):
    mock_get_csv.return_value = _CSV.encode()

    def fake_ticker(market):
        if market.startswith("btc"):
            raise MaxApiError("boom")
        return {"last": "65000"}

    mock_ticker.side_effect = fake_ticker

    resp = portfolio.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    currencies = {h["currency"] for h in body["holdings"]}
    assert currencies == {"ETH"}


@patch.object(portfolio.S3StorageService, "get_trades_csv")
def test_no_open_positions_returns_empty_holdings(mock_get_csv):
    csv_text = (
        "timestamp,currency,price,action,change,balance\n"
        "1700000000000,BTC,2000000,buy,0.01,0.01\n"
        "1700100000000,BTC,2100000,sell,-0.01,0.0\n"
    )
    mock_get_csv.return_value = csv_text.encode()

    resp = portfolio.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["holdings"] == []
    assert body["total_value"] == 0.0


@patch.object(portfolio.S3StorageService, "get_trades_csv")
def test_invalid_csv_returns_400(mock_get_csv):
    mock_get_csv.return_value = b"not,a,valid,csv"
    resp = portfolio.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 400
