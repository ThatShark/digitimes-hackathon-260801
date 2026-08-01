"""Unit tests for the POST /questionnaire/submit Lambda handler.

Bedrock and S3 calls are mocked so these tests run offline and
deterministically.
"""

import json
from unittest.mock import patch

from src.handlers import submit_questionnaire
from src.services import personality_save
from src.services.s3_storage import S3StorageError, S3StorageService


def _event(body, user_id="demo-user"):
    return {
        "queryStringParameters": {"user_id": user_id} if user_id else {},
        "body": json.dumps(body),
    }


_VALID_BODY = {
    "questionnaire_id": "test-qid",
    "answers": [{"question_id": "q1", "option_id": "4"}, {"question_id": "q2", "option_id": "2"}],
}


def test_missing_user_id_returns_400():
    resp = submit_questionnaire.lambda_handler(_event(_VALID_BODY, user_id=None), None)
    assert resp["statusCode"] == 400


def test_missing_answers_returns_400():
    resp = submit_questionnaire.lambda_handler(_event({"questionnaire_id": "x", "answers": []}), None)
    assert resp["statusCode"] == 400


def test_unparseable_body_returns_400():
    resp = submit_questionnaire.lambda_handler(
        {"queryStringParameters": {"user_id": "demo-user"}, "body": "not-json"}, None
    )
    assert resp["statusCode"] == 400


@patch.object(personality_save.BedrockChatClient, "chat")
def test_happy_path_returns_personality_and_descriptions(mock_chat):
    mock_chat.return_value = "AI 生成的描述"
    resp = submit_questionnaire.lambda_handler(_event(_VALID_BODY), None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["status"] == "ready"
    assert set(body["personality"].keys()) == {"code", "name", "axes"}
    assert set(body["personality"]["axes"].keys()) == {"R", "E", "F", "S"}
    assert body["personality_description"] == "AI 生成的描述"


@patch.object(S3StorageService, "put_questionnaire_response")
@patch.object(S3StorageService, "put_trade_metrics")
@patch.object(personality_save.BedrockChatClient, "chat")
def test_persists_to_s3_when_bucket_configured(mock_chat, mock_put_metrics, mock_put_response, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_chat.return_value = "描述"

    resp = submit_questionnaire.lambda_handler(_event(_VALID_BODY), None)
    assert resp["statusCode"] == 200
    mock_put_metrics.assert_called_once()
    mock_put_response.assert_called_once()


@patch.object(S3StorageService, "put_trade_metrics")
@patch.object(personality_save.BedrockChatClient, "chat")
def test_s3_write_failure_returns_502(mock_chat, mock_put_metrics, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_chat.return_value = "描述"
    mock_put_metrics.side_effect = S3StorageError("boom")

    resp = submit_questionnaire.lambda_handler(_event(_VALID_BODY), None)
    assert resp["statusCode"] == 502


@patch.object(personality_save.BedrockChatClient, "chat")
def test_bedrock_failure_does_not_block_response(mock_chat):
    mock_chat.side_effect = Exception("bedrock down")
    resp = submit_questionnaire.lambda_handler(_event(_VALID_BODY), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["personality_description"] == ""
