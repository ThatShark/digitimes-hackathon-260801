"""Submit Supplementary Quiz Lambda handler.

Implements POST /quiz/submit for the two smaller supplementary
questionnaires (風險承受度評估 / 市場情緒敏感度) — see
src/data/supplementary_quizzes.py for why these are scored separately
from the main EFS personality bank.

Request body:
{
  "quiz_id": "risk-tolerance",
  "answers": [{"question_id": 1, "option_id": "A"}, ...]
}

Success response 200:
{ "status": "ready", "score": 72, "label": "積極型", "message": "..." }

Error responses:
  400 — missing user id, unknown quiz_id, or missing answers
"""

import json
import os

from src.data.supplementary_quizzes import SUPPLEMENTARY_QUIZZES, resolve_label
from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """POST /quiz/submit"""
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    quiz_id = body.get("quiz_id")
    quiz = SUPPLEMENTARY_QUIZZES.get(quiz_id)
    if not quiz:
        return _error(400, "未知的問卷 ID")

    answers = body.get("answers")
    if not answers or not isinstance(answers, list):
        return _error(400, "缺少作答內容")

    score = _score_answers(quiz, answers)
    label, message = resolve_label(quiz_id, score)

    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if bucket:
        try:
            storage = S3StorageService(bucket_name=bucket)
            storage.put_questionnaire_response(
                user_id,
                quiz_id,
                json.dumps(
                    {"quiz_id": quiz_id, "answers": answers, "score": score, "label": label},
                    ensure_ascii=False,
                ),
            )
        except S3StorageError as exc:
            print(f"[SUBMIT_QUIZ] failed to persist response: {exc}")

    return json_response(200, {"status": "ready", "score": score, "label": label, "message": message})


def _score_answers(quiz, answers) -> int:
    values = []
    for answer in answers:
        try:
            question_id = int(answer.get("question_id"))
        except (TypeError, ValueError):
            continue
        weight = quiz["questions"].get(question_id, {}).get(answer.get("option_id"))
        if weight is not None:
            values.append(weight)
    if not values:
        return 50
    return round(sum(values) / len(values))


def _extract_user_id(event) -> "str | None":
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("user_id")
    if user_id:
        return user_id
    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("user_id")
    if user_id:
        return user_id
    try:
        return event["requestContext"]["authorizer"]["claims"]["sub"]
    except (KeyError, TypeError):
        return None


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
