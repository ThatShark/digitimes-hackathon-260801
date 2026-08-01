"""Upload CSV Lambda handler.

Orchestrates the POST /upload_csv flow (operationId `uploadCsv` in
`backend/api.yaml`): retrieve the user's raw trade fills CSV from S3,
compute trading metrics via `backend/src/utils/metrics.py`, write the
resulting metrics JSON back to S3, and return an HTTP response shaped per
`UploadCsvResponse` / `ErrorResponse`.

This module contains no calculation or validation logic of its own
(Requirement 7.3) — it only branches on the presence of an `"error"` key in
the JSON returned by `compute_metrics_json`.
"""

import json
import os

from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.metrics import compute_metrics_json

# Assumption: the S3 bucket name is not yet wired up elsewhere in this
# codebase, so it is read from an environment variable with this name. This
# is a placeholder pending real infrastructure/deployment configuration.
_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"


def lambda_handler(event, context):
    """POST /upload_csv per backend/api.yaml operationId uploadCsv.

    Orchestrates: S3 read -> compute_metrics_json -> S3 write -> HTTP response.
    """
    user_id = _extract_user_id(event)
    if not user_id:
        # No established auth/user-identity mechanism exists yet in this
        # codebase (see _extract_user_id for the placeholder extraction
        # strategy). Treat a missing user id as a client error rather than
        # crashing the invocation.
        return _error_response(400, "缺少使用者身份資訊")

    storage = S3StorageService(bucket_name=_bucket_name())

    try:
        trades_bytes = storage.get_trades_csv(user_id)
    except S3StorageError:
        return _error_response(502, "無法讀取交易紀錄，請稍後再試")

    metrics_json = compute_metrics_json(trades_bytes)
    parsed = json.loads(metrics_json)
    if "error" in parsed:
        return _error_response(400, parsed["error"])

    try:
        storage.put_trade_metrics(user_id, metrics_json)
    except S3StorageError:
        return _error_response(502, "無法儲存分析結果，請稍後再試")

    currencies = _extract_currencies(trades_bytes)
    return _success_response(currencies)


def _extract_user_id(event) -> "str | None":
    """Extract the user id from the Lambda event.

    Placeholder pending real auth integration: this project does not yet
    have an established auth/user-identity mechanism, so this checks (in
    order) query string parameters, path parameters, and a Cognito-style
    authorizer claim, returning None if none are present. Callers must
    treat None as a client error rather than assuming a default user.
    """
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("user_id")
    if user_id:
        return user_id

    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("user_id")
    if user_id:
        return user_id

    try:
        claim_user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    except (KeyError, TypeError):
        claim_user_id = None
    return claim_user_id or None


def _bucket_name() -> str:
    """Return the S3 bucket name for trade data.

    Placeholder pending real infrastructure configuration: read from the
    TRADES_BUCKET_NAME environment variable.
    """
    return os.environ.get(_BUCKET_NAME_ENV_VAR, "")


def _extract_currencies(trades_bytes: bytes) -> list:
    """Extract distinct currency symbols from the uploaded trade fills CSV.

    This is a small adjacent responsibility needed only to satisfy the
    `currencies` field required by `UploadCsvResponse` in backend/api.yaml;
    it is not part of the metrics computation itself. The CSV input format
    (parsed by `backend.src.utils.metrics.parse_trades_csv` into
    `RawFill.currency`) does carry real per-row currency data, but wiring
    that up correctly here (e.g. deciding whether to report every currency
    seen or only those with a closed round-trip) is out of scope for this
    task. Returning an empty list for now.
    TODO: derive the actual list of distinct currencies from the parsed
    fills/records once that behavior is specified.
    """
    return []


def _error_response(status_code: int, message: str) -> dict:
    """Build an API Gateway proxy response matching ErrorResponse."""
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"status": "error", "message": message}, ensure_ascii=False),
    }


def _success_response(currencies: list) -> dict:
    """Build an API Gateway proxy response matching UploadCsvResponse."""
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {"status": "ready", "currencies": currencies}, ensure_ascii=False
        ),
    }
