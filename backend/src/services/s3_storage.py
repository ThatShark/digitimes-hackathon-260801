"""S3 storage service: I/O boundary for reading/writing user trade data in S3.

Reads `users/{userId}/trades.csv` and writes `users/{userId}/trade_metrics.json`,
with a fixed retry policy (3 attempts total, 2 second delay between attempts).

This module contains no calculation logic. All metric computation lives in
`backend/src/utils/metrics.py`.
"""

import time
from typing import Optional

import boto3
from botocore.exceptions import ClientError

RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2


class S3StorageError(Exception):
    """Raised after retries are exhausted for a read or write operation."""


class S3StorageService:
    def __init__(self, bucket_name: str, client=None):
        self._bucket = bucket_name
        self._client = client or boto3.client("s3")

    def get_trades_csv(self, user_id: str) -> bytes:
        """Reads users/{userId}/trades.csv. Retries up to RETRY_ATTEMPTS times with
        RETRY_DELAY_SECONDS between attempts (Req 6.3). Raises S3StorageError on
        exhausted retries."""
        key = f"users/{user_id}/trades.csv"
        return self._get_with_retry(key)

    def get_trade_metrics(self, user_id: str) -> bytes:
        """Reads users/{userId}/trade_metrics.json — the personality scores +
        AI description previously computed by upload_csv.py / save_personality.py.
        Raises S3StorageError if it doesn't exist yet (e.g. CSV uploaded but
        analysis hasn't been run/saved)."""
        key = f"users/{user_id}/trade_metrics.json"
        return self._get_with_retry(key)

    def put_trade_metrics(self, user_id: str, metrics_json: str) -> None:
        """Writes users/{userId}/trade_metrics.json. Retries up to RETRY_ATTEMPTS
        times with RETRY_DELAY_SECONDS between attempts (Req 6.5). Raises
        S3StorageError on exhausted retries."""
        key = f"users/{user_id}/trade_metrics.json"
        self._put_with_retry(key, metrics_json)

    def put_questionnaire_response(self, user_id: str, questionnaire_id: str, response_json: str) -> None:
        """Writes users/{userId}/questionnaire/{questionnaire_id}.json. Retries up to
        RETRY_ATTEMPTS times with RETRY_DELAY_SECONDS between attempts."""
        key = f"users/{user_id}/questionnaire/{questionnaire_id}.json"
        self._put_with_retry(key, response_json)

    def put_quiz_result(self, user_id: str, quiz_id: str, result_json: str) -> None:
        """Writes users/{userId}/quiz_results/{quiz_id}.json. Retries up to
        RETRY_ATTEMPTS times with RETRY_DELAY_SECONDS between attempts."""
        key = f"users/{user_id}/quiz_results/{quiz_id}.json"
        self._put_with_retry(key, result_json)

    def get_quiz_result(self, user_id: str, quiz_id: str) -> bytes:
        """Reads users/{userId}/quiz_results/{quiz_id}.json. Raises S3StorageError
        if not found or after retries exhausted."""
        key = f"users/{user_id}/quiz_results/{quiz_id}.json"
        return self._get_with_retry(key)

    def get_questionnaire_response(self, user_id: str, questionnaire_id: str) -> bytes:
        """Reads users/{userId}/questionnaire/{questionnaire_id}.json. Retries up to
        RETRY_ATTEMPTS times with RETRY_DELAY_SECONDS between attempts. Raises
        S3StorageError on exhausted retries."""
        key = f"users/{user_id}/questionnaire/{questionnaire_id}.json"
        return self._get_with_retry(key)

    def put_trades_csv(self, user_id: str, csv_bytes: bytes) -> None:
        """Writes users/{userId}/trades.csv. Retries up to RETRY_ATTEMPTS times."""
        key = f"users/{user_id}/trades.csv"
        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                self._client.put_object(
                    Bucket=self._bucket,
                    Key=key,
                    Body=csv_bytes,
                    ContentType="text/csv",
                )
                return
            except ClientError as exc:
                last_error = exc
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)
        raise S3StorageError(
            f"Failed to write s3://{self._bucket}/{key} after {RETRY_ATTEMPTS} attempts"
        ) from last_error

    def _get_with_retry(self, key: str) -> bytes:
        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                response = self._client.get_object(Bucket=self._bucket, Key=key)
                return response["Body"].read()
            except ClientError as exc:
                last_error = exc
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)
        raise S3StorageError(
            f"Failed to read s3://{self._bucket}/{key} after {RETRY_ATTEMPTS} attempts"
        ) from last_error

    def _put_with_retry(self, key: str, body: str) -> None:
        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                self._client.put_object(
                    Bucket=self._bucket,
                    Key=key,
                    Body=body.encode("utf-8"),
                    ContentType="application/json",
                )
                return
            except ClientError as exc:
                last_error = exc
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)
        raise S3StorageError(
            f"Failed to write s3://{self._bucket}/{key} after {RETRY_ATTEMPTS} attempts"
        ) from last_error
