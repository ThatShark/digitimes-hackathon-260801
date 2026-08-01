"""Trade History Lambda handler.

Implements GET /trade_history per backend/api.yaml operationId getTradeHistory.

Reads users/{userId}/trades.csv from S3 and returns:
  - summary: total trade count, win rate, avg holding days, most-traded coins
    (backend/src/utils/metrics.py's compute_trade_summary)
  - history: per-transaction rows, newest first, with per-sell pnl%
    (backend/src/utils/metrics.py's build_trade_history)

Query parameters:
    user_id (required, until real auth exists)
    limit   (optional) max rows in `history`, default 50, max 500

Success response 200:
{
  "status": "ready",
  "summary": {"total_trades": 342, "win_rate": 58.2, "avg_hold_days": 3.4,
              "top_coins": ["BTC", "ETH", "SOL"]},
  "history": [
    {"timestamp_ms": 1722200000000, "action": "sell", "currency": "BTC",
     "amount_twd": 8000.0, "price": 2920000.0, "pnl_pct": 2.5}
  ]
}
"""

import os

from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import (
    TradeDataError,
    build_trade_history,
    compute_trade_summary,
    parse_trades_csv,
)

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"
_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500


def lambda_handler(event, context):
    """GET /trade_history — trade summary + per-transaction history."""
    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    query_params = event.get("queryStringParameters") or {}
    limit_raw = query_params.get("limit")
    limit = _DEFAULT_LIMIT
    if limit_raw is not None:
        try:
            limit = int(limit_raw)
        except ValueError:
            return _error(400, "limit 必須為整數")
        if limit < 1 or limit > _MAX_LIMIT:
            return _error(400, f"limit 必須在 1 到 {_MAX_LIMIT} 之間")

    storage = S3StorageService(bucket_name=os.environ.get(_BUCKET_NAME_ENV_VAR, ""))
    try:
        trades_bytes = storage.get_trades_csv(user_id)
    except S3StorageError:
        return json_response(404, {"status": "need_csv", "message": "尚未上傳交易紀錄，請先上傳 CSV 檔案"})

    try:
        trades = parse_trades_csv(trades_bytes)
    except TradeDataError as exc:
        return _error(400, str(exc))

    summary = compute_trade_summary(trades)
    history = build_trade_history(trades, limit=limit)

    return json_response(200, {"status": "ready", "summary": summary, "history": history})


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
