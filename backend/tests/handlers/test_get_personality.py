"""Unit tests for the GET /personality Lambda handler."""

import json
from unittest.mock import patch

from src.handlers import get_personality
from src.services.s3_storage import S3StorageError


def _event(**query_params):
    return {"queryStringParameters": {k: v for k, v in query_params.items() if v is not None}}


def test_missing_user_id_returns_400():
    resp = get_personality.lambda_handler({"queryStringParameters": {}}, None)
    assert resp["statusCode"] == 400


@patch.object(get_personality.S3StorageService, "get_trade_metrics")
def test_no_metrics_returns_404_need_csv(mock_get):
    mock_get.side_effect = S3StorageError("not found")
    resp = get_personality.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert body["status"] == "need_csv"


@patch.object(get_personality.S3StorageService, "get_trade_metrics")
def test_existing_metrics_returned(mock_get):
    stored = {
        "r_score": 62.5, "e_score": 40.0, "f_score": 71.0, "s_score": 55.0,
        "personality_description": "積極型的短線玩家",
        "personality_analysis": "長版分析...",
    }
    mock_get.return_value = json.dumps(stored, ensure_ascii=False).encode("utf-8")

    resp = get_personality.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert body["scores"]["r_score"] == 62.5
    assert body["personality_description"] == "積極型的短線玩家"


@patch.object(get_personality.S3StorageService, "get_trade_metrics")
def test_missing_score_fields_default_to_50(mock_get):
    mock_get.return_value = b'{"personality_description": "x"}'
    resp = get_personality.lambda_handler(_event(user_id="demo"), None)
    body = json.loads(resp["body"])
    assert body["scores"] == {"r_score": 50, "e_score": 50, "f_score": 50, "s_score": 50}


@patch.object(get_personality.S3StorageService, "get_trade_metrics")
def test_corrupt_json_returns_404_need_csv(mock_get):
    mock_get.return_value = b"not valid json"
    resp = get_personality.lambda_handler(_event(user_id="demo"), None)
    assert resp["statusCode"] == 404
