"""Init Lambda handler.

Implements GET /init per backend/api.yaml operationId getInit.

Called once when the app loads. Lets the frontend know whether this user
still needs to upload their CSV, or whether one is already stored in S3
(so the frontend doesn't have to ask them to upload it again every visit).

This is a lightweight existence check only — it does NOT re-run the
personality analysis pipeline (that's POST /upload_csv with no body).
It just reads users/{userId}/trades.csv and reports which currencies are
in it, using the same CSV parser as the rest of the backend.

Query parameters:
    user_id (required, until real auth exists)

Success response 200 — InitResponse:
    {"status": "need_csv"}
    {"status": "ready", "currencies": ["BTC", "ETH", ...]}
"""

import os

from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import TradeDataError, parse_trades_csv

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """GET /init — check whether the user already has a stored CSV."""
    user_id = _extract_user_id(event)
    if not user_id:
        return _error(400, "缺少使用者身份資訊")

    storage = S3StorageService(bucket_name=os.environ.get(_BUCKET_NAME_ENV_VAR, ""))

    try:
        trades_bytes = storage.get_trades_csv(user_id)
    except S3StorageError:
        return json_response(200, {"status": "need_csv"})

    try:
        trades = parse_trades_csv(trades_bytes)
    except TradeDataError:
        # Stored CSV is corrupt/unreadable — treat the same as "no CSV yet"
        # so the frontend offers to re-upload rather than getting stuck.
        return json_response(200, {"status": "need_csv"})

    currencies = sorted({t.currency.upper() for t in trades if t.currency.lower() != "twd"})
    return json_response(200, {"status": "ready", "currencies": currencies})


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
