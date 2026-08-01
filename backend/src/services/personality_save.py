"""共用邏輯：把 R/E/F/S 四軸分數轉成 AI 描述文字，並寫入 S3。

從 backend/src/handlers/save_personality.py 抽出，供 save_personality.py（問卷
舊版/CSV 分析呼叫路徑）與 backend/src/handlers/submit_questionnaire.py（新版
EFS 32 題問卷）共用，避免兩處各自維護一份 Bedrock 呼叫 + S3 寫入邏輯。
"""

import json
import time

from src.services.bedrock import BedrockChatClient, BedrockError, load_personality_long_prompt
from src.services.s3_storage import S3StorageService

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def generate_and_save_personality(user_id, r, e, f, s, code, name, source="questionnaire", bucket_name=""):
    """產生短/長 AI 人格描述並寫入 users/{userId}/trade_metrics.json。

    Returns:
        dict: {"personality_description": str, "personality_analysis": str}

    Raises:
        S3StorageError: 寫入 S3 失敗（重試耗盡後）。Bedrock 失敗不會拋出例外，
            AI 生成失敗時對應描述欄位會是空字串，不影響存檔。
    """
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
        "source": source,
    }

    personality_description = ""
    personality_analysis = ""
    try:
        # 找出離 50 最遠的兩個維度，短描述聚焦在最突出的特質上
        axes_deviation = [
            ("R", r, abs(r - 50), "風險偏好", "防守型" if r < 50 else "積極型"),
            ("E", e, abs(e - 50), "情緒控制", "冷靜型" if e < 50 else "情緒型"),
            ("F", f, abs(f - 50), "交易頻率", "長線型" if f < 50 else "短線型"),
            ("S", s, abs(s - 50), "策略類型", "直覺型" if s < 50 else "量化型"),
        ]
        axes_deviation.sort(key=lambda x: x[2], reverse=True)
        top2 = axes_deviation[:2]

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
        time.sleep(1)

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
        print(f"[PERSONALITY_SAVE] Bedrock error: {exc}")
        # AI 生成失敗不影響存儲

    parsed["personality_description"] = personality_description
    parsed["personality_analysis"] = personality_analysis

    if not personality_description and personality_analysis:
        first_sentence = (
            personality_analysis.split("。")[0] + "。"
            if "。" in personality_analysis
            else personality_analysis[:50]
        )
        parsed["personality_description"] = first_sentence
        personality_description = first_sentence

    if bucket_name:
        storage = S3StorageService(bucket_name=bucket_name)
        storage.put_trade_metrics(user_id, json.dumps(parsed, ensure_ascii=False))

    return {
        "personality_description": personality_description,
        "personality_analysis": personality_analysis,
    }
