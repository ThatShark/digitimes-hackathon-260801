"""Save Personality Lambda handler.

Implements POST /personality — receives questionnaire results from frontend,
generates AI personality descriptions via Bedrock, and stores everything
to S3 at users/{userId}/trade_metrics.json (same location as CSV analysis).
"""

import json
import os

from src.services.personality_save import generate_and_save_personality
from src.services.s3_storage import S3StorageError
from src.utils.http import json_response

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """POST /personality"""
    # ── Parse request body ────────────────────────────────────────────────────
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    personality = body.get("personality")
    if not personality or not isinstance(personality, dict):
        return _error(400, "缺少投資人格資料")

    axes = personality.get("axes", {})
    r = axes.get("R", 50)
    e = axes.get("E", 50)
    f = axes.get("F", 50)
    s = axes.get("S", 50)
    code = personality.get("code", "")
    name = personality.get("name", "")

    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    try:
        result = generate_and_save_personality(
            user_id, r, e, f, s, code, name, source="questionnaire", bucket_name=bucket
        )
    except S3StorageError:
        return _error(502, "無法儲存分析結果，請稍後再試")

    return json_response(200, {
        "status": "ready",
        "personality_description": result["personality_description"],
        "personality_analysis": result["personality_analysis"],
        "scores": {"r_score": r, "e_score": e, "f_score": f, "s_score": s},
    })


# ─────────────────────────────────────────────────────────────────────────────

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
