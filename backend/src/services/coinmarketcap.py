"""CoinMarketCap API client.

Provides access to the CMC Fear & Greed Index using the keyless public
endpoint (no API key required). Falls back to the authenticated endpoint
when a CMC_API_KEY environment variable is present, enabling a smooth path
to the paid tier without code changes.

Retry policy: 3 attempts, 2-second delay — consistent with max_api.py and
s3_storage.py.

Reference: https://pro.coinmarketcap.com/api/documentation/
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

CMC_BASE_URL        = "https://pro-api.coinmarketcap.com"
CMC_KEYLESS_BASE    = "https://pro-api.coinmarketcap.com/public-api"
CMC_API_KEY_ENV_VAR = "CMC_API_KEY"

RETRY_ATTEMPTS      = 3
RETRY_DELAY_SECONDS = 2


class CoinMarketCapError(Exception):
    """Raised when the CMC API returns an error or all retries are exhausted."""


class CoinMarketCapClient:
    """Thin wrapper around the CoinMarketCap public API (stdlib only)."""

    def __init__(self, api_key: "str | None" = None, timeout: int = 10):
        # Prefer an explicitly passed key, then env var, then keyless mode.
        self._api_key = api_key or os.environ.get(CMC_API_KEY_ENV_VAR)
        self._timeout = timeout

        if self._api_key:
            self._base_url = CMC_BASE_URL
        else:
            self._base_url = CMC_KEYLESS_BASE

    # ─────────────────────────────────────────────────────────────────────────
    # Public methods
    # ─────────────────────────────────────────────────────────────────────────

    def get_fear_greed_latest(self) -> dict:
        """Return the latest Fear & Greed Index value.

        Response shape (data sub-object):
            value               : int   (0–100)
            value_classification: str   ("Extreme Fear" | "Fear" |
                                         "Neutral" | "Greed" | "Extreme Greed")
            update_time         : str   (ISO-8601 UTC)

        Raises CoinMarketCapError on non-200 or after RETRY_ATTEMPTS failures.
        """
        return self._get("/v3/fear-and-greed/latest")

    def get_fear_greed_historical(
        self, start: int = 1, limit: int = 50
    ) -> dict:
        """Return historical Fear & Greed Index values.

        Args:
            start: Starting offset (1-indexed). Default 1.
            limit: Number of records to return. Default 50.

        Response shape (data field is a list):
            [{"timestamp": "...", "value": 50, "value_classification": "Neutral"}, ...]

        Raises CoinMarketCapError on non-200 or after RETRY_ATTEMPTS failures.
        """
        return self._get(
            "/v3/fear-and-greed/historical",
            {"start": start, "limit": limit},
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _get(self, path: str, params: "dict | None" = None) -> Any:
        """HTTP GET with retry logic. Returns parsed JSON body."""
        query_string = urllib.parse.urlencode(params) if params else ""
        url = f"{self._base_url}{path}"
        if query_string:
            url = f"{url}?{query_string}"

        headers: dict[str, str] = {"Accept": "application/json"}
        if self._api_key:
            headers["X-CMC_PRO_API_KEY"] = self._api_key

        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=self._timeout) as response:
                    body = response.read().decode("utf-8")
                    return json.loads(body)
            except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
                last_error = exc
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)

        raise CoinMarketCapError(
            f"CMC API request to {path} failed after {RETRY_ATTEMPTS} attempts"
        ) from last_error
