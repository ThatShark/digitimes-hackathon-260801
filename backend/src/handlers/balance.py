"""Balance Lambda handler.

Implements GET /balance — returns the user's available TWD cash balance
computed from their trade CSV history.

Query parameters:
    user_id (required, until real auth exists)

Success response 200:
{
  "status": "ready",
  "twd_balance": 125000.50
}
"""

import os

from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import TradeDataError, compute_twd_balance, parse_trades_csv

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """GET /balance — TWD cash balance from trade history."""
    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    storage = S3StorageService(bucket_name=os.environ.get(_BUCKET_NAME_ENV_VAR, ""))
    try:
        trades_bytes = storage.get_trades_csv(user_id)
    except S3StorageError:
        return json_response(200, {"status": "ready", "twd_balance": 0.0})

    try:
        trades = parse_trades_csv(trades_bytes)
    except TradeDataError as exc:
        return _error(400, str(exc))

    twd_balance = compute_twd_balance(trades)
    return json_response(200, {"status": "ready", "twd_balance": twd_balance})


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
