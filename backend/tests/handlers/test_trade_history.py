"""Unit tests for the GET /trade_history Lambda handler."""

import json
from unittest.mock import patch

from src.handlers import trade_history
from src.services.s3_storage import S3StorageError

_CSV = (
    "timestamp,currency,price,action,change,balance\n"
    "1700000000000,BTC,2000000,buy,0.02,0.02\n"
    "1700100000000,BTC,2200000,sell,-0.02,0.0\n"
    "1700200000000,ETH,60000,buy,1.0,1.0\n"
    "1700300000000,ETH,55000,sell,-1.0,0.0\n"
)


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def test_missing_user_id_returns_400():
    resp = trade_history.lambda_handler({"queryStringParameters": {}}, None)
    assert resp["statusCode"] == 400


def test_invalid_limit_returns_400():
    resp = trade_history.lambda_handler(_event(user_id="demo", limit="abc"), None)
    assert resp["statusCode"] == 400


def test_limit_out_of_range_returns_400():
    resp = trade_history.lambda_handler(_event(user_id="demo", limit="0"), None)
    assert resp["statusCode"] == 400
    resp2 = trade_history.lambda_handler(_event(user_id="demo", limit="501"), None)
    assert resp2["statusCode"] == 400


@patch.object(trade_history.S3StorageService, "get_trades_csv")
def test_no_csv_returns_404_need_csv(mock_get):
    mock_get.side_effect = S3StorageError("not found")
    resp = trade_history.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert body["status"] == "need_csv"


@patch.object(trade_history.S3StorageService, "get_trades_csv")
def test_summary_and_history_returned(mock_get):
    mock_get.return_value = _CSV.encode()
    resp = trade_history.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["summary"]["total_trades"] == 4
    assert body["summary"]["win_rate"] == 50.0
    assert len(body["history"]) == 4
    # newest first
    assert body["history"][0]["timestamp_ms"] == 1700300000000


@patch.object(trade_history.S3StorageService, "get_trades_csv")
def test_limit_trims_history(mock_get):
    mock_get.return_value = _CSV.encode()
    resp = trade_history.lambda_handler(_event(user_id="demo", limit="2"), None)
    body = json.loads(resp["body"])
    assert len(body["history"]) == 2


@patch.object(trade_history.S3StorageService, "get_trades_csv")
def test_invalid_csv_returns_400(mock_get):
    mock_get.return_value = b"garbage"
    resp = trade_history.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 400
