"""Unit tests for the GET /questionnaire Lambda handler.

Pure static data + random sampling, no external services to mock.
"""

import json

from src.handlers import get_questionnaire


def test_returns_200_with_id_and_20_questions():
    resp = get_questionnaire.lambda_handler({}, None)
    assert resp["statusCode"] == 200
    assert "Access-Control-Allow-Origin" in resp["headers"]

    body = json.loads(resp["body"])
    assert "id" in body
    assert len(body["questions"]) == 20


def test_questions_only_expose_id_text_options():
    resp = get_questionnaire.lambda_handler({}, None)
    body = json.loads(resp["body"])
    for q in body["questions"]:
        assert set(q.keys()) == {"id", "text", "options"}
        assert len(q["options"]) == 7


def test_repeated_calls_can_return_different_order():
    orders = set()
    for _ in range(10):
        resp = get_questionnaire.lambda_handler({}, None)
        body = json.loads(resp["body"])
        orders.add(tuple(q["id"] for q in body["questions"]))
    # extremely unlikely all 10 shuffles collide if randomization is working
    assert len(orders) > 1
