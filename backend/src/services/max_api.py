"""MAX Exchange public API client.

Wraps MAX public REST API v3 endpoints (no auth required) with a fixed retry
policy — 3 attempts, 2-second delay between attempts — consistent with the
rest of this backend (see s3_storage.py).

Reference: https://max-api.maicoin.com/doc/v3.html
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

MAX_BASE_URL = "https://max-api.maicoin.com"
RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2


class MaxApiError(Exception):
    """Raised when the MAX API returns an error or all retries are exhausted."""


class MaxApiClient:
    """Thin wrapper around the MAX public API using only stdlib (no extra deps)."""

    def __init__(self, base_url: str = MAX_BASE_URL, timeout: int = 10):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    # ─────────────────────────────────────────────────────────────────────────
    # Public methods
    # ─────────────────────────────────────────────────────────────────────────

    def get_ticker(self, market: str) -> dict:
        """Return the latest ticker for a single market.

        ``market`` is lowercase symbol + quote currency per MAX convention,
        e.g. ``"btctwd"``, ``"ethtwd"``, ``"soltwd"``.

        Relevant response fields:
            market, at, buy, sell, last, open, low, high, vol

        Raises MaxApiError on non-200 or after RETRY_ATTEMPTS failures.
        """
        return self._get("/api/v3/ticker", {"market": market.lower()})

    def get_tickers(self, markets: list[str]) -> list[dict]:
        """Return tickers for multiple markets in one call.

        MAX expects the query parameter repeated: ``markets[]=btctwd&markets[]=ethtwd``.
        """
        params = [("markets[]", m.lower()) for m in markets]
        return self._get("/api/v3/tickers", params)

    def get_klines(
        self,
        market: str,
        period: int,
        limit: int,
        timestamp: "int | None" = None,
    ) -> list[list]:
        """Return candlestick (K-line) data for a market.

        Args:
            market:    MAX market ID, e.g. ``"btctwd"``.
            period:    Candle interval in minutes. Supported values:
                       1, 5, 15, 30, 60, 120, 240, 360, 720, 1440, 4320, 10080.
            limit:     Number of candles to return (1–10000).
            timestamp: Optional Unix timestamp (seconds). When provided, MAX
                       returns candles with open time >= this value.

        Returns a list of ``[timestamp, open, high, low, close, volume]`` lists,
        where timestamp is Unix seconds and all other values are floats.

        Raises MaxApiError on non-200 or after RETRY_ATTEMPTS failures.
        """
        params: dict = {
            "market": market.lower(),
            "period": period,
            "limit": limit,
        }
        if timestamp is not None:
            params["timestamp"] = timestamp
        return self._get("/api/v3/k", params)

    def get_markets(self) -> list[dict]:
        """Return all available markets from MAX."""
        return self._get("/api/v3/markets", {})

    def get_trades(
        self,
        market: str,
        limit: int = 1000,
        timestamp_ms: "int | None" = None,
    ) -> list[dict]:
        """Return recent executed trades for a market, newest first.

        Args:
            market:       MAX market ID, e.g. ``"btctwd"``.
            limit:        Number of trades to return (1–1000, MAX's max per call).
            timestamp_ms: Optional Unix timestamp in MILLISECONDS. When
                          provided, only trades strictly older than this
                          timestamp are returned — pass the oldest trade's
                          `created_at` from the previous page to page
                          further back in time (the boundary trade itself
                          is not repeated).

        Each trade dict has: id, price, volume, funds (TWD value of the
        trade), market, side ("bid"=buyer-initiated/"ask"=seller-initiated),
        created_at (Unix milliseconds).

        Raises MaxApiError on non-200 or after RETRY_ATTEMPTS failures.
        """
        params: dict = {"market": market.lower(), "limit": limit}
        if timestamp_ms is not None:
            params["timestamp"] = timestamp_ms
        return self._get("/api/v3/trades", params)

    def get_depth(self, market: str, limit: int = 100) -> dict:
        """Return the current order book (bids/asks) for a market.

        Args:
            market: MAX market ID, e.g. ``"btctwd"``.
            limit:  Number of price levels per side (1–300).

        Returns a dict with `asks`/`bids`, each a list of
        ``[price_str, volume_str]`` pairs, best price first.

        Raises MaxApiError on non-200 or after RETRY_ATTEMPTS failures.
        """
        return self._get("/api/v3/depth", {"market": market.lower(), "limit": limit})

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _get(self, path: str, params: Any) -> Any:
        """HTTP GET with retry logic. Returns parsed JSON body."""
        if isinstance(params, dict):
            query_string = urllib.parse.urlencode(params) if params else ""
        else:
            # list of (key, value) tuples — used for repeated-key params
            query_string = urllib.parse.urlencode(params, doseq=True) if params else ""

        url = f"{self._base_url}{path}"
        if query_string:
            url = f"{url}?{query_string}"

        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                with urllib.request.urlopen(url, timeout=self._timeout) as response:
                    body = response.read().decode("utf-8")
                    return json.loads(body)
            except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
                last_error = exc
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)

        raise MaxApiError(
            f"MAX API request to {path} failed after {RETRY_ATTEMPTS} attempts"
        ) from last_error
