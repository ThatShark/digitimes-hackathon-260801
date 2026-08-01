"""Upload CSV Lambda handler.

Orchestrates POST /upload_csv: read CSV from S3, fetch K-line data from
external API, compute 4-axis personality scores, write result to S3.
"""

import json
import math
import os
import statistics
import urllib.request

from src.services.bedrock import BedrockChatClient, BedrockError, load_personality_prompt
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

    if body_content and ("text/csv" in content_type or "," in body_content[:200]):
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
            return json_response(502, {"status": "error", "message": "無法讀取交易紀錄，請稍後再試"})

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
    try:
        r = parsed.get("r_score", 50)
        e = parsed.get("e_score", 50)
        f = parsed.get("f_score", 50)
        s = parsed.get("s_score", 50)

        personality_prompt = load_personality_prompt()
        user_message = f"R={r:.0f}, E={e:.0f}, F={f:.0f}, S={s:.0f}"

        bedrock_client = BedrockChatClient(max_tokens=200, temperature=0.8)
        messages = [{"role": "user", "content": [{"text": user_message}]}]
        personality_description = bedrock_client.chat(messages, system_prompt=personality_prompt)
    except (BedrockError, Exception):
        # AI 生成失敗不影響主流程，使用預設描述
        personality_description = ""

    # Attach AI description to metrics before saving
    parsed["personality_description"] = personality_description
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
