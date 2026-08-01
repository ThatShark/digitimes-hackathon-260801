"""MAX Exchange authenticated trading client.

Implements HMAC-SHA256 request signing per the MAX V3 auth scheme:
1. Build payload dict: {path, nonce, ...params}
2. Base64-encode the JSON payload
3. HMAC-SHA256 the base64 string with the API secret
4. Attach headers: X-MAX-ACCESSKEY, X-MAX-PAYLOAD, X-MAX-SIGNATURE

Reference: https://github.com/bistin/max-mcp-server (client.py)

Environment variables:
    MAX_API_KEY    — your MAX API access key
    MAX_API_SECRET — your MAX API secret key
"""

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

MAX_BASE_URL = "https://max-api.maicoin.com"
RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1

_last_nonce = 0


class MaxTradingError(Exception):
    """Raised when the MAX trading API returns an error."""

    def __init__(self, message: str, status: int = 0, code: Optional[int] = None):
        super().__init__(message)
        self.status = status
        self.code = code


class MaxTradingClient:
    """Authenticated MAX V3 trading client (stdlib only, no async)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        base_url: str = MAX_BASE_URL,
        timeout: int = 15,
    ):
        self._api_key = api_key or os.environ.get("MAX_API_KEY", "")
        self._api_secret = api_secret or os.environ.get("MAX_API_SECRET", "")
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

        if not self._api_key or not self._api_secret:
            raise MaxTradingError(
                "MAX_API_KEY 和 MAX_API_SECRET 環境變數未設定，無法進行交易"
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Public methods
    # ─────────────────────────────────────────────────────────────────────────

    def create_order(
        self,
        market: str,
        side: str,
        volume: str,
        ord_type: str = "market",
        price: Optional[str] = None,
        wallet_type: str = "spot",
    ) -> dict:
        """Place an order on MAX Exchange.

        Args:
            market:      e.g. "btctwd"
            side:        "buy" or "sell"
            volume:      Amount as string (e.g. "0.001")
            ord_type:    "market", "limit", "stop_limit", "stop_market"
            price:       Required for limit orders (string)
            wallet_type: "spot" (default) or "m"

        Returns:
            Order response dict from MAX API.

        Raises:
            MaxTradingError on failure.
        """
        params: dict[str, Any] = {
            "market": market.lower(),
            "side": side.lower(),
            "volume": volume,
            "ord_type": ord_type,
        }
        if price is not None:
            params["price"] = price

        path = f"/api/v3/wallet/{wallet_type}/order"
        return self._private_post(path, params)

    def get_accounts(self) -> list[dict]:
        """Get account balances."""
        return self._private_get("/api/v3/wallet/spot/accounts")

    def get_order(self, order_id: int) -> dict:
        """Get a specific order by ID."""
        return self._private_get("/api/v3/wallet/spot/order", {"id": order_id})

    # ─────────────────────────────────────────────────────────────────────────
    # Signing & request helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _next_nonce(self) -> int:
        """Return a strictly increasing millisecond nonce."""
        global _last_nonce
        n = int(time.time() * 1000)
        if n <= _last_nonce:
            n = _last_nonce + 1
        _last_nonce = n
        return n

    def _sign(self, path: str, params: dict) -> tuple:
        """Build base64 payload and HMAC-SHA256 signature.

        Returns (payload_b64, signature_hex, signed_params_with_nonce).
        """
        nonce = self._next_nonce()
        signed_params = {**params, "nonce": nonce}

        # Payload includes path + all params (sorted keys)
        payload_dict = dict(sorted({"path": path, **signed_params}.items()))
        payload_json = json.dumps(payload_dict)
        payload_b64 = base64.b64encode(payload_json.encode()).decode()

        signature = hmac.HMAC(
            self._api_secret.encode(),
            payload_b64.encode(),
            hashlib.sha256,
        ).hexdigest()

        return payload_b64, signature, signed_params

    def _build_headers(self, payload_b64: str, signature: str) -> dict:
        return {
            "X-MAX-ACCESSKEY": self._api_key,
            "X-MAX-PAYLOAD": payload_b64,
            "X-MAX-SIGNATURE": signature,
            "Content-Type": "application/json",
        }

    def _private_post(self, path: str, params: dict) -> Any:
        """Signed POST request with retry."""
        payload_b64, signature, signed_params = self._sign(path, params)
        headers = self._build_headers(payload_b64, signature)
        url = f"{self._base_url}{path}"
        body = json.dumps(signed_params).encode()

        return self._request_with_retry(url, headers, body, method="POST")

    def _private_get(self, path: str, params: Optional[dict] = None) -> Any:
        """Signed GET request with retry."""
        params = params or {}
        payload_b64, signature, signed_params = self._sign(path, params)
        headers = self._build_headers(payload_b64, signature)

        # GET: params go in query string
        query = urllib.parse.urlencode(signed_params) if signed_params else ""
        url = f"{self._base_url}{path}"
        if query:
            url = f"{url}?{query}"

        return self._request_with_retry(url, headers, data=None, method="GET")

    def _request_with_retry(
        self, url: str, headers: dict, data: Optional[bytes], method: str
    ) -> Any:
        """Execute HTTP request with retry logic."""
        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                req = urllib.request.Request(url, data=data, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                    resp_body = resp.read().decode("utf-8")
                    return json.loads(resp_body)
            except urllib.error.HTTPError as exc:
                resp_body = exc.read().decode("utf-8", errors="replace")
                try:
                    err_json = json.loads(resp_body)
                    err_obj = err_json.get("error", {})
                    raise MaxTradingError(
                        err_obj.get("message", resp_body),
                        status=exc.code,
                        code=err_obj.get("code"),
                    )
                except (json.JSONDecodeError, AttributeError):
                    raise MaxTradingError(resp_body, status=exc.code)
            except (urllib.error.URLError, OSError) as exc:
                last_error = exc
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)

        raise MaxTradingError(
            f"MAX API 連線失敗，已重試 {RETRY_ATTEMPTS} 次"
        ) from last_error
