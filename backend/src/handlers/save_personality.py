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
        import time as _time

        # 找出離 50 最遠的兩個維度
        axes_deviation = [
            ("R", r, abs(r - 50), "風險偏好", "防守型" if r < 50 else "積極型"),
            ("E", e, abs(e - 50), "情緒控制", "冷靜型" if e < 50 else "情緒型"),
            ("F", f, abs(f - 50), "交易頻率", "長線型" if f < 50 else "短線型"),
            ("S", s, abs(s - 50), "策略類型", "直覺型" if s < 50 else "量化型"),
        ]
        axes_deviation.sort(key=lambda x: x[2], reverse=True)
        top2 = axes_deviation[:2]

        # Short description — 根據最偏差的兩個維度生成 ~30 字描述
        short_system = (
            "你是投資人格分析師。根據用戶最突出的兩個投資特質，"
            "用一句話（約30字）描述他的投資風格。"
            "描述要具體有畫面感，使用繁體中文，只回覆描述文字本身。"
        )
        short_message = (
            f"這位用戶最突出的兩個特質：\n"
            f"1. {top2[0][3]}={top2[0][0]}{top2[0][1]:.0f}（{top2[0][4]}，偏離中值{top2[0][2]:.0f}分）\n"
            f"2. {top2[1][3]}={top2[1][0]}{top2[1][1]:.0f}（{top2[1][4]}，偏離中值{top2[1][2]:.0f}分）\n"
            f"完整分數：R={r:.0f}, E={e:.0f}, F={f:.0f}, S={s:.0f}"
        )
        bedrock_client = BedrockChatClient(max_tokens=100, temperature=0.8)
        messages = [{"role": "user", "content": [{"text": short_message}]}]
        personality_description = bedrock_client.chat(messages, system_prompt=short_system)

        # 間隔 1 秒再呼叫下一次
        _time.sleep(1)

        # Long analysis — 詳細分析，注入 AI 對話 system prompt
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

    # Fallback: 如果短描述為空但長描述有值，取長描述第一句話
    if not personality_description and personality_analysis:
        first_sentence = personality_analysis.split("。")[0] + "。" if "。" in personality_analysis else personality_analysis[:50]
        parsed["personality_description"] = first_sentence
        personality_description = first_sentence

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
