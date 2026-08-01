"""Fear & Greed Index Lambda handler.

Implements GET /market/fear-greed per backend/api.yaml operationId
getFearGreed.

Query parameters:
    mode     (optional): "latest" | "historical", default "latest"
    start    (optional): offset for historical mode, default 1
    limit    (optional): record count for historical mode, default 30

Success response 200 — latest mode (FearGreedLatestResponse):
{
  "status": "ready",
  "mode":   "latest",
  "data": {
    "value":                40,
    "value_classification": "Fear",
    "update_time":          "2024-09-19T02:54:56.017Z"
  }
}

Success response 200 — historical mode (FearGreedHistoricalResponse):
{
  "status": "ready",
  "mode":   "historical",
  "data": [
    {"timestamp": "2024-09-02T12:00:00.000Z", "value": 50, "value_classification": "Neutral"},
    ...
  ]
}

Error responses:
  400 — invalid mode / limit param
  502 — CMC API unreachable after retries
  503 — CMC returned an unexpected response shape
"""

import json

from src.services.coinmarketcap import CoinMarketCapClient, CoinMarketCapError

_VALID_MODES      = {"latest", "historical"}
_DEFAULT_MODE     = "latest"
_DEFAULT_LIMIT    = 30
_MAX_LIMIT        = 500


def lambda_handler(event, context):
    """GET /market/fear-greed"""
    params = event.get("queryStringParameters") or {}

    # ── mode ─────────────────────────────────────────────────────────────────
    mode = params.get("mode", _DEFAULT_MODE).strip().lower()
    if mode not in _VALID_MODES:
        return _error(400, f"不支援的 mode 值 '{mode}'，請使用 latest 或 historical")

    # ── historical-only params ────────────────────────────────────────────────
    try:
        start = max(1, int(params.get("start", 1)))
    except (ValueError, TypeError):
        return _error(400, "start 必須為正整數")

    try:
        limit = int(params.get("limit", _DEFAULT_LIMIT))
        if not (1 <= limit <= _MAX_LIMIT):
            raise ValueError
    except (ValueError, TypeError):
        return _error(400, f"limit 必須介於 1 到 {_MAX_LIMIT} 之間")

    client = CoinMarketCapClient()

    if mode == "latest":
        return _handle_latest(client)
    else:
        return _handle_historical(client, start, limit)


# ─────────────────────────────────────────────────────────────────────────────
# Mode handlers
# ─────────────────────────────────────────────────────────────────────────────

def _handle_latest(client: CoinMarketCapClient) -> dict:
    try:
        raw = client.get_fear_greed_latest()
    except CoinMarketCapError:
        return _error(502, "無法取得恐懼貪婪指數，請稍後再試")

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, dict) or "value" not in data:
        return _error(503, "CMC API 回傳格式異常")

    return _success("latest", {
        "value":                int(data["value"]),
        "value_classification": data.get("value_classification", ""),
        "update_time":          data.get("update_time", ""),
    })


def _handle_historical(
    client: CoinMarketCapClient, start: int, limit: int
) -> dict:
    try:
        raw = client.get_fear_greed_historical(start=start, limit=limit)
    except CoinMarketCapError:
        return _error(502, "無法取得恐懼貪婪指數，請稍後再試")

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, list):
        return _error(503, "CMC API 回傳格式異常")

    records = [
        {
            "timestamp":          entry.get("timestamp", ""),
            "value":              int(entry["value"]),
            "value_classification": entry.get("value_classification", ""),
        }
        for entry in data
        if isinstance(entry, dict) and "value" in entry
    ]

    return _success("historical", records)


# ─────────────────────────────────────────────────────────────────────────────
# Response builders
# ─────────────────────────────────────────────────────────────────────────────

def _success(mode: str, data) -> dict:
    body = {"status": "ready", "mode": mode, "data": data}
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _error(status_code: int, message: str) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {"status": "error", "message": message}, ensure_ascii=False
        ),
    }
