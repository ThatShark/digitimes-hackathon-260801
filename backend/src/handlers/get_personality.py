"""Get Personality Lambda handler.

Implements GET /personality per backend/api.yaml operationId getPersonality.

Read-only counterpart to upload_csv.py / save_personality.py: those two
handlers COMPUTE and WRITE users/{userId}/trade_metrics.json, this handler
just READS it back. Used by ProfilePage on page load so the frontend can
show real personality data without re-running the (slow, Bedrock-backed)
analysis pipeline every time.

Response shape intentionally matches POST /upload_csv's response
(`scores.{r,e,f,s}_score` + `personality_description`) so the frontend can
reuse the same `_buildPersonalityFromScores()` parsing logic for both.

Success response 200:
{
  "status": "ready",
  "personality_description": "...",
  "personality_analysis": "...",
  "scores": {"r_score": 62.5, "e_score": 40.0, "f_score": 71.0, "s_score": 55.0}
}

404 response — no analysis has been run yet (CSV not uploaded, or uploaded
but /upload_csv never called to analyze it):
{"status": "need_csv", "message": "..."}
"""

import json
import os

from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """GET /personality — read previously-computed personality scores from S3."""
    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    storage = S3StorageService(bucket_name=os.environ.get(_BUCKET_NAME_ENV_VAR, ""))
    try:
        metrics_bytes = storage.get_trade_metrics(user_id)
    except S3StorageError:
        return json_response(404, {"status": "need_csv", "message": "尚未完成人格分析，請先上傳 CSV 檔案"})

    try:
        parsed = json.loads(metrics_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return json_response(404, {"status": "need_csv", "message": "人格分析資料損毀，請重新上傳 CSV 檔案"})

    return json_response(200, {
        "status": "ready",
        "personality_description": parsed.get("personality_description", ""),
        "personality_analysis": parsed.get("personality_analysis", ""),
        "scores": {
            "r_score": parsed.get("r_score", 50),
            "e_score": parsed.get("e_score", 50),
            "f_score": parsed.get("f_score", 50),
            "s_score": parsed.get("s_score", 50),
        },
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
