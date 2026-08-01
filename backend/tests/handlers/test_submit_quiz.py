"""Unit tests for the POST /quiz/submit Lambda handler (the two
supplementary quizzes: risk-tolerance / market-sentiment)."""

import json
from unittest.mock import patch

from src.handlers import submit_quiz
from src.services.s3_storage import S3StorageError, S3StorageService


def _event(body, user_id="demo-user"):
    return {
        "queryStringParameters": {"user_id": user_id} if user_id else {},
        "body": json.dumps(body),
    }


def test_missing_user_id_returns_400():
    resp = submit_quiz.lambda_handler(
        _event({"quiz_id": "risk-tolerance", "answers": [{"question_id": 1, "option_id": "A"}]}, user_id=None),
        None,
    )
    assert resp["statusCode"] == 400


def test_unknown_quiz_id_returns_400():
    resp = submit_quiz.lambda_handler(_event({"quiz_id": "does-not-exist", "answers": []}), None)
    assert resp["statusCode"] == 400


def test_missing_answers_returns_400():
    resp = submit_quiz.lambda_handler(_event({"quiz_id": "risk-tolerance", "answers": []}), None)
    assert resp["statusCode"] == 400


def test_unparseable_body_returns_400():
    resp = submit_quiz.lambda_handler(
        {"queryStringParameters": {"user_id": "demo-user"}, "body": "not-json"}, None
    )
    assert resp["statusCode"] == 400


def test_all_a_answers_score_100_and_label_aggressive():
    body = {
        "quiz_id": "risk-tolerance",
        "answers": [
            {"question_id": 1, "option_id": "A"},
            {"question_id": 2, "option_id": "A"},
            {"question_id": 3, "option_id": "A"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    result = json.loads(resp["body"])
    assert result["score"] == 100
    assert result["label"] == "積極型"
    assert result["message"]


def test_all_d_answers_score_0_and_label_conservative():
    body = {
        "quiz_id": "risk-tolerance",
        "answers": [
            {"question_id": 1, "option_id": "D"},
            {"question_id": 2, "option_id": "D"},
            {"question_id": 3, "option_id": "D"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    result = json.loads(resp["body"])
    assert result["score"] == 0
    assert result["label"] == "保守型"


def test_market_sentiment_quiz_scores_independently():
    body = {
        "quiz_id": "market-sentiment",
        "answers": [
            {"question_id": 1, "option_id": "D"},
            {"question_id": 2, "option_id": "C"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    result = json.loads(resp["body"])
    # Q1 D=0, Q2 C=10 -> mean 5
    assert result["score"] == 5
    assert result["label"] == "冷靜自律型"


def test_unknown_question_or_option_is_ignored():
    body = {
        "quiz_id": "risk-tolerance",
        "answers": [
            {"question_id": 99, "option_id": "A"},
            {"question_id": 1, "option_id": "Z"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    result = json.loads(resp["body"])
    assert result["score"] == 50  # no valid answers -> neutral default


@patch.object(S3StorageService, "put_questionnaire_response")
def test_persists_to_s3_when_bucket_configured(mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    body = {"quiz_id": "risk-tolerance", "answers": [{"question_id": 1, "option_id": "B"}]}
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    mock_put.assert_called_once()


@patch.object(S3StorageService, "put_questionnaire_response")
def test_s3_failure_does_not_block_response(mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_put.side_effect = S3StorageError("boom")
    body = {"quiz_id": "risk-tolerance", "answers": [{"question_id": 1, "option_id": "B"}]}
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
