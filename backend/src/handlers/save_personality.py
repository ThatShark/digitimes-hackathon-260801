"""Save Personality Lambda handler.

Implements POST /personality — receives questionnaire results from frontend,
generates AI personality descriptions via Bedrock, and stores everything
to S3 at users/{userId}/trade_metrics.json (same location as CSV analysis).
"""

import json
import os

from src.services.bedrock import (
    BedrockChatClient,
    BedrockError,
    load_personality_prompt,
    load_personality_long_prompt,
)
from src.services.s3_storage import S3StorageError, S3StorageService
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

    # ── Build metrics JSON (same structure as CSV analysis) ────────────────────
    parsed = {
        "r_score": r,
        "e_score": e,
        "f_score": f,
        "s_score": s,
        "r_s1_volatility": r,
        "r_s2_concentration": r,
        "r_s3_drawdown": r,
        "e_s1_fomo": e,
        "e_s2_revenge": e,
        "e_s3_impulsive": e,
        "f_mti_hours": 720 if f < 50 else 24 if f < 75 else 2,
        "s_s1_regularity": s,
        "s_s2_discipline": s,
        "personality_code": code,
        "personality_name": name,
        "source": "questionnaire",
    }

    # ── Generate AI personality descriptions via Bedrock ──────────────────────
    personality_description = ""
    personality_analysis = ""
    try:
        bedrock_client = BedrockChatClient(max_tokens=200, temperature=0.8)

        # Short description
        short_prompt = load_personality_prompt()
        short_message = f"R={r:.0f}, E={e:.0f}, F={f:.0f}, S={s:.0f}"
        messages = [{"role": "user", "content": [{"text": short_message}]}]
        personality_description = bedrock_client.chat(messages, system_prompt=short_prompt)

        # Long analysis
        long_prompt = load_personality_long_prompt()
        if long_prompt:
            long_message = (
                f"R={r:.0f} (波動偏好={r:.0f}, 集中度={r:.0f}, 回撤容忍={r:.0f})\n"
                f"E={e:.0f} (追漲={e:.0f}, 報復交易={e:.0f}, 衝動={e:.0f})\n"
                f"F={f:.0f} (MTI={parsed['f_mti_hours']:.1f} 小時)\n"
                f"S={s:.0f} (規律性={s:.0f}, 紀律性={s:.0f})"
            )
            long_client = BedrockChatClient(max_tokens=500, temperature=0.7)
            long_messages = [{"role": "user", "content": [{"text": long_message}]}]
            personality_analysis = long_client.chat(long_messages, system_prompt=long_prompt)
    except (BedrockError, Exception) as exc:
        print(f"[SAVE_PERSONALITY] Bedrock error: {exc}")
        # AI 生成失敗不影響存儲

    parsed["personality_description"] = personality_description
    parsed["personality_analysis"] = personality_analysis

    # ── Save to S3 ────────────────────────────────────────────────────────────
    metrics_json = json.dumps(parsed, ensure_ascii=False)
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if bucket:
        try:
            storage = S3StorageService(bucket_name=bucket)
            storage.put_trade_metrics(user_id, metrics_json)
        except S3StorageError:
            return _error(502, "無法儲存分析結果，請稍後再試")

    return json_response(200, {
        "status": "ready",
        "personality_description": personality_description,
        "personality_analysis": personality_analysis,
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
