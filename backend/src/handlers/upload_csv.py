"""Upload CSV Lambda handler.

Orchestrates POST /upload_csv: read CSV from S3, fetch K-line data from
external API, compute 4-axis personality scores, write result to S3.
"""

import json
import math
import os
import statistics
import urllib.request

from src.services.bedrock import BedrockChatClient, BedrockError, load_personality_prompt, load_personality_long_prompt
from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import (
    Candle,
    TradeDataError,
    compute_metrics_json,
    parse_trades_csv,
)

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"

_EXTERNAL_API_BASE = (
    "https://wuu7t4t06l.execute-api.ap-northeast-1.amazonaws.com/prod"
)

# Fetch K-lines starting 30 days before earliest trade (for volatility).
_KLINE_LOOKBACK_SECONDS = 30 * 24 * 3600


def lambda_handler(event, context):
    """POST /upload_csv — personality analysis pipeline."""
    user_id = _extract_user_id(event)
    if not user_id:
        return json_response(400, {"status": "error", "message": "缺少使用者身份資訊"})

    storage = S3StorageService(bucket_name=_bucket_name())

    # ── Determine CSV source: request body or S3 ─────────────────────────────
    body_content = event.get("body") or ""
    content_type = ""
    headers = event.get("headers") or {}
    for k, v in headers.items():
        if k.lower() == "content-type":
            content_type = v.lower()
            break

    if body_content and ("text/csv" in content_type or "csv" in content_type or "," in body_content[:200]):
        # CSV was sent directly in the request body (upload from browser)
        import base64
        if event.get("isBase64Encoded"):
            trades_bytes = base64.b64decode(body_content)
        else:
            trades_bytes = body_content.encode("utf-8") if isinstance(body_content, str) else body_content
        # Save to S3 for future re-analysis
        try:
            storage.put_trades_csv(user_id, trades_bytes)
        except Exception:
            pass  # Non-critical: analysis can still proceed
    else:
        # No CSV in body — read from S3
        try:
            trades_bytes = storage.get_trades_csv(user_id)
        except S3StorageError:
            return json_response(404, {"status": "need_csv", "message": "尚未上傳交易紀錄，請先上傳 CSV 檔案"})

    # Parse CSV to get currencies + time range for external API calls.
    try:
        trades = parse_trades_csv(trades_bytes)
    except TradeDataError as exc:
        return json_response(400, {"status": "error", "message": str(exc)})

    if not trades:
        return json_response(400, {"status": "error", "message": "CSV 中沒有交易資料"})

    currencies = sorted(set(t.currency for t in trades))

    # Time range (ms -> sec)
    earliest_ms = min(t.timestamp_ms for t in trades)
    latest_ms = max(t.timestamp_ms for t in trades)
    start_sec = (earliest_ms // 1000) - _KLINE_LOOKBACK_SECONDS
    end_sec = latest_ms // 1000

    # Fetch K-line data and compute volatility per currency
    klines_by_currency: dict[str, list[Candle]] = {}
    volatility_by_currency: dict[str, float] = {}

    for currency in currencies:
        candles = _fetch_klines(currency, start_sec, end_sec)
        if candles:
            klines_by_currency[currency] = candles
            vol = _compute_annualized_volatility(candles)
            if vol is not None:
                volatility_by_currency[currency] = vol

    # Compute personality scores
    metrics_json = compute_metrics_json(
        trades_bytes,
        klines_by_currency=klines_by_currency or None,
        volatility_by_currency=volatility_by_currency or None,
    )
    parsed = json.loads(metrics_json)
    if "error" in parsed:
        return json_response(400, {"status": "error", "message": parsed["error"]})

    # ── Generate AI personality description via Bedrock ────────────────────────
    personality_description = ""
    personality_analysis = ""
    try:
        import time as _time

        r = parsed.get("r_score", 50)
        e = parsed.get("e_score", 50)
        f = parsed.get("f_score", 50)
        s = parsed.get("s_score", 50)

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

        # Long analysis (詳細分析，注入 AI 對話 system prompt)
        long_prompt = load_personality_long_prompt()
        if long_prompt:
            long_message = (
                f"R={r:.0f} (波動偏好={parsed.get('r_s1_volatility', 0):.0f}, "
                f"集中度={parsed.get('r_s2_concentration', 0):.0f}, "
                f"回撤容忍={parsed.get('r_s3_drawdown', 0):.0f})\n"
                f"E={e:.0f} (追漲={parsed.get('e_s1_fomo', 0):.0f}, "
                f"報復交易={parsed.get('e_s2_revenge', 0):.0f}, "
                f"衝動={parsed.get('e_s3_impulsive', 0):.0f})\n"
                f"F={f:.0f} (MTI={parsed.get('f_mti_hours', 0):.1f} 小時)\n"
                f"S={s:.0f} (規律性={parsed.get('s_s1_regularity', 0):.0f}, "
                f"紀律性={parsed.get('s_s2_discipline', 0):.0f})"
            )
            long_client = BedrockChatClient(max_tokens=500, temperature=0.7)
            long_messages = [{"role": "user", "content": [{"text": long_message}]}]
            personality_analysis = long_client.chat(long_messages, system_prompt=long_prompt)
    except (BedrockError, Exception):
        # AI 生成失敗不影響主流程
        pass

    # Attach AI descriptions to metrics before saving
    parsed["personality_description"] = personality_description
    parsed["personality_analysis"] = personality_analysis

    # Fallback: 如果短描述為空但長描述有值，取長描述第一句話
    if not personality_description and personality_analysis:
        first_sentence = personality_analysis.split("。")[0] + "。" if "。" in personality_analysis else personality_analysis[:50]
        parsed["personality_description"] = first_sentence
        personality_description = first_sentence

    metrics_json = json.dumps(parsed, ensure_ascii=False)

    try:
        storage.put_trade_metrics(user_id, metrics_json)
    except S3StorageError:
        return json_response(502, {"status": "error", "message": "無法儲存分析結果，請稍後再試"})

    return json_response(200, {
        "status": "ready",
        "currencies": currencies,
        "personality_description": personality_description,
        "scores": {
            "r_score": parsed.get("r_score", 0),
            "e_score": parsed.get("e_score", 0),
            "f_score": parsed.get("f_score", 0),
            "s_score": parsed.get("s_score", 0),
        },
    })


# ─────────────────────────────────────────────────────────────────────────────
# External API helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_klines(currency: str, start: int, end: int, timeout: int = 10) -> list[Candle]:
    """GET /candlestick_chart -> list[Candle]. Returns [] on any failure."""
    from datetime import datetime, timezone

    url = (
        f"{_EXTERNAL_API_BASE}/candlestick_chart"
        f"?currency={currency.upper()}&start={start}&end={end}&interval=1d"
    )
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            if resp.status != 200:
                return []
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []

    if data.get("status") != "ready" or "candles" not in data:
        return []

    candles: list[Candle] = []
    for c in data["candles"]:
        try:
            ts = int(c["time"])
            dt = datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)
            candles.append(Candle(
                timestamp=dt, open=float(c["open"]), high=float(c["high"]),
                low=float(c["low"]), close=float(c["close"]), volume=float(c["volume"]),
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return candles


def _compute_annualized_volatility(candles: list[Candle]) -> "float | None":
    """stdev(daily_returns) * sqrt(365). None if < 3 candles."""
    if len(candles) < 3:
        return None
    sorted_c = sorted(candles, key=lambda c: c.timestamp)
    returns = []
    for i in range(1, len(sorted_c)):
        prev = sorted_c[i - 1].close
        if prev > 0:
            returns.append((sorted_c[i].close - prev) / prev)
    if len(returns) < 2:
        return None
    return statistics.stdev(returns) * math.sqrt(365)


# ─────────────────────────────────────────────────────────────────────────────
# Lambda event helpers
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


def _bucket_name() -> str:
    return os.environ.get(_BUCKET_NAME_ENV_VAR, "")
