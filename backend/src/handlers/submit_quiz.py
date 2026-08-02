"""Submit Supplementary Quiz Lambda handler.

Implements POST /quiz/submit for the supplementary questionnaires:
  - investment-habits (投資習慣)
  - investment-experience (投資經驗)
  - investment-budget (投資預算與目標)

All use 7-point Likert scale (option_id "1"~"7"). Each quiz has multiple
dimensions; this handler computes per-dimension average scores and saves
the full result to S3 for AI chat to read as context.

Request body:
{
  "quiz_id": "investment-habits",
  "answers": [{"question_id": "h1", "option_id": "5"}, ...]
}

Success response 200:
{
  "status": "ready",
  "quiz_id": "investment-habits",
  "dimensions": {
    "info_source": {"name": "資訊來源偏好", "avg_score": 4.5, "answers_count": 4},
    ...
  },
  "overall_avg": 4.2,
  "message": "感謝你的作答！AI 將根據這些資料提供更精準的個人化建議。"
}

Error responses:
  400 — missing user id, unknown quiz_id, or missing answers
"""

import json
import os

from src.data.supplementary_quizzes import (
    SUPPLEMENTARY_QUIZZES,
    score_supplementary_quiz,
)
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
    if quiz_id not in SUPPLEMENTARY_QUIZZES:
        return _error(400, "未知的問卷 ID")

    answers = body.get("answers")
    if not answers or not isinstance(answers, list):
        return _error(400, "缺少作答內容")

    # 計算各維度分數
    result = score_supplementary_quiz(quiz_id, answers)

    # 存入 S3: users/{userId}/quiz_results/{quiz_id}.json
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if bucket:
        try:
            storage = S3StorageService(bucket_name=bucket)
            storage.put_quiz_result(user_id, quiz_id, json.dumps(result, ensure_ascii=False))
        except (S3StorageError, Exception) as exc:
            print(f"[SUBMIT_QUIZ] failed to persist result: {exc}")

    # 組裝回應訊息
    message = "感謝你的作答！AI 將根據這些資料提供更精準的個人化建議。"

    return json_response(200, {
        "status": "ready",
        "quiz_id": quiz_id,
        "dimensions": result["dimensions"],
        "overall_avg": result["overall_avg"],
        "message": message,
    })


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
