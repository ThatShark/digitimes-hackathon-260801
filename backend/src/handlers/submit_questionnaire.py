"""Submit Questionnaire Lambda handler.

Implements POST /questionnaire/submit per backend/api.yaml operationId
submitQuestionnaire.

Request body:
{
  "questionnaire_id": "<uuid>",   // logged only, not required for scoring
  "answers": [{"question_id": "q7", "option_id": "4"}, ...]
}

Success response 200:
{
  "status": "ready",
  "personality": {"code": "ACSI", "name": "弄潮兒", "axes": {"R":72,"E":55,"F":80,"S":40}},
  "personality_description": "...",
  "personality_analysis": "..."
}

Error responses:
  400 — missing user id or empty/invalid answers
  502 — failed to persist result to S3 after retries
"""

import json
import os

from src.services.questionnaire_scoring import score_answers
from src.services.personality_save import generate_and_save_personality
from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """POST /questionnaire/submit"""
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    answers = body.get("answers")
    if not answers or not isinstance(answers, list):
        return _error(400, "缺少作答內容")

    questionnaire_id = body.get("questionnaire_id") or "unknown"

    personality = score_answers(answers)
    r, e, f, s = (
        personality["axes"]["R"],
        personality["axes"]["E"],
        personality["axes"]["F"],
        personality["axes"]["S"],
    )

    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    try:
        result = generate_and_save_personality(
            user_id, r, e, f, s,
            personality["code"], personality["name"],
            source="questionnaire", bucket_name=bucket,
        )
    except S3StorageError:
        return _error(502, "無法儲存分析結果，請稍後再試")

    # 額外保存這次原始作答（供未來問卷歷史功能使用），失敗不影響主流程
    if bucket:
        try:
            storage = S3StorageService(bucket_name=bucket)
            storage.put_questionnaire_response(
                user_id,
                questionnaire_id,
                json.dumps({"questionnaire_id": questionnaire_id, "answers": answers, "personality": personality}, ensure_ascii=False),
            )
        except S3StorageError as exc:
            print(f"[SUBMIT_QUESTIONNAIRE] failed to persist raw response: {exc}")

    return json_response(200, {
        "status": "ready",
        "personality": personality,
        "personality_description": result["personality_description"],
        "personality_analysis": result["personality_analysis"],
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
