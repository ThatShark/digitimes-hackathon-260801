"""Unit tests for the GET /quiz Lambda handler.

Pure static data + random sampling, no external services to mock.
"""

import json

from src.handlers import get_quiz


def _event(quiz_id):
    return {"queryStringParameters": {"quiz_id": quiz_id}}


def test_unknown_quiz_id_returns_404():
    resp = get_quiz.lambda_handler(_event("does-not-exist"), None)
    assert resp["statusCode"] == 404


def test_missing_quiz_id_returns_404():
    resp = get_quiz.lambda_handler({"queryStringParameters": {}}, None)
    assert resp["statusCode"] == 404


def test_returns_200_with_id_title_and_20_questions():
    resp = get_quiz.lambda_handler(_event("investment-habits"), None)
    assert resp["statusCode"] == 200
    assert "Access-Control-Allow-Origin" in resp["headers"]

    body = json.loads(resp["body"])
    assert body["id"] == "investment-habits"
    assert body["title"] == "投資習慣問卷"
    assert len(body["questions"]) == 20


def test_questions_only_expose_id_text_options():
    resp = get_quiz.lambda_handler(_event("investment-experience"), None)
    body = json.loads(resp["body"])
    for q in body["questions"]:
        assert set(q.keys()) == {"id", "text", "options"}
        assert len(q["options"]) == 7


def test_path_parameter_fallback_works():
    resp = get_quiz.lambda_handler(
        {"queryStringParameters": {}, "pathParameters": {"quizId": "investment-budget"}}, None
    )
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["id"] == "investment-budget"
    assert len(body["questions"]) == 20


def test_repeated_calls_can_return_different_order():
    orders = set()
    for _ in range(10):
        resp = get_quiz.lambda_handler(_event("investment-habits"), None)
        body = json.loads(resp["body"])
        orders.add(tuple(q["id"] for q in body["questions"]))
    assert len(orders) > 1
