"""Unit tests for the POST /quiz/submit Lambda handler (supplementary quizzes:
investment-habits / investment-experience / investment-budget).

All supplementary quizzes now use a 7-point Likert scale (option_id "1"~"7"),
and return per-dimension average scores rather than a single score + label.
"""

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
        _event({"quiz_id": "investment-habits", "answers": [{"question_id": "h1", "option_id": "5"}]}, user_id=None),
        None,
    )
    assert resp["statusCode"] == 400


def test_unknown_quiz_id_returns_400():
    resp = submit_quiz.lambda_handler(_event({"quiz_id": "does-not-exist", "answers": [{"question_id": "x", "option_id": "3"}]}), None)
    assert resp["statusCode"] == 400


def test_missing_answers_returns_400():
    resp = submit_quiz.lambda_handler(_event({"quiz_id": "investment-habits", "answers": []}), None)
    assert resp["statusCode"] == 400


def test_unparseable_body_returns_400():
    resp = submit_quiz.lambda_handler(
        {"queryStringParameters": {"user_id": "demo-user"}, "body": "not-json"}, None
    )
    assert resp["statusCode"] == 400


def test_habits_quiz_returns_dimensions_and_overall():
    body = {
        "quiz_id": "investment-habits",
        "answers": [
            {"question_id": "h1", "option_id": "7"},
            {"question_id": "h2", "option_id": "3"},
            {"question_id": "h5", "option_id": "5"},
            {"question_id": "h9", "option_id": "6"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    result = json.loads(resp["body"])
    assert result["status"] == "ready"
    assert result["quiz_id"] == "investment-habits"
    assert "dimensions" in result
    assert "overall_avg" in result
    assert "message" in result
    # Check info_source dimension has correct avg
    dims = result["dimensions"]
    assert "info_source" in dims
    assert dims["info_source"]["avg_score"] == 5.0  # (7+3)/2
    assert dims["info_source"]["answers_count"] == 2


def test_experience_quiz_all_7s_returns_max_avg():
    answers = [{"question_id": f"e{i}", "option_id": "7"} for i in range(1, 16)]
    body = {"quiz_id": "investment-experience", "answers": answers}
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    result = json.loads(resp["body"])
    assert result["overall_avg"] == 7.0
    for dim_data in result["dimensions"].values():
        assert dim_data["avg_score"] == 7.0


def test_budget_quiz_all_1s_returns_min_avg():
    answers = [{"question_id": f"b{i}", "option_id": "1"} for i in range(1, 14)]
    body = {"quiz_id": "investment-budget", "answers": answers}
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    result = json.loads(resp["body"])
    assert result["overall_avg"] == 1.0


def test_unknown_question_id_is_ignored():
    body = {
        "quiz_id": "investment-habits",
        "answers": [
            {"question_id": "unknown_q", "option_id": "5"},
            {"question_id": "h1", "option_id": "4"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    result = json.loads(resp["body"])
    # Only h1 is valid, so overall_avg should be 4.0
    assert result["overall_avg"] == 4.0


def test_out_of_range_option_is_ignored():
    body = {
        "quiz_id": "investment-habits",
        "answers": [
            {"question_id": "h1", "option_id": "9"},  # invalid: > 7
            {"question_id": "h2", "option_id": "5"},
        ],
    }
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    result = json.loads(resp["body"])
    # Only h2 is valid
    assert result["overall_avg"] == 5.0


@patch.object(S3StorageService, "put_quiz_result")
def test_persists_to_s3_when_bucket_configured(mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    body = {"quiz_id": "investment-habits", "answers": [{"question_id": "h1", "option_id": "4"}]}
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
    mock_put.assert_called_once()


@patch.object(S3StorageService, "put_quiz_result")
def test_s3_failure_does_not_block_response(mock_put, monkeypatch):
    monkeypatch.setenv("TRADES_BUCKET_NAME", "test-bucket")
    mock_put.side_effect = S3StorageError("boom")
    body = {"quiz_id": "investment-habits", "answers": [{"question_id": "h1", "option_id": "4"}]}
    resp = submit_quiz.lambda_handler(_event(body), None)
    assert resp["statusCode"] == 200
