"""Unit tests for the GET /init Lambda handler."""

import json
from unittest.mock import patch

from src.handlers import init
from src.services.s3_storage import S3StorageError

_CSV = (
    "timestamp,currency,price,action,change,balance\n"
    "1700000000000,twd,1.0,deposit,50000,50000\n"
    "1700100000000,BTC,2000000,buy,0.02,0.02\n"
    "1700200000000,ETH,60000,buy,1.0,1.0\n"
)


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def test_missing_user_id_returns_400():
    resp = init.lambda_handler({"queryStringParameters": {}}, None)
    assert resp["statusCode"] == 400
    assert "Access-Control-Allow-Origin" in resp["headers"]


@patch.object(init.S3StorageService, "get_trades_csv")
def test_no_csv_in_s3_returns_need_csv(mock_get):
    mock_get.side_effect = S3StorageError("not found")
    resp = init.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "need_csv"


@patch.object(init.S3StorageService, "get_trades_csv")
def test_existing_csv_returns_ready_with_currencies(mock_get):
    mock_get.return_value = _CSV.encode()
    resp = init.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["currencies"] == ["BTC", "ETH"]


@patch.object(init.S3StorageService, "get_trades_csv")
def test_twd_cash_excluded_from_currencies(mock_get):
    mock_get.return_value = _CSV.encode()
    resp = init.lambda_handler(_event(user_id="demo"), None)
    body = json.loads(resp["body"])
    assert "TWD" not in body["currencies"]


@patch.object(init.S3StorageService, "get_trades_csv")
def test_corrupt_csv_treated_as_need_csv(mock_get):
    mock_get.return_value = b"garbage not a csv"
    resp = init.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "need_csv"
