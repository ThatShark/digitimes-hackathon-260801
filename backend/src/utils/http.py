"""Shared HTTP response helpers for Lambda proxy-integration handlers.

AWS API Gateway's "Enable CORS" console action (or a bare OPTIONS mock
integration) only adds Access-Control-* headers to the OPTIONS preflight
response. It does NOT add them to the actual GET/POST/etc. response coming
back from the Lambda function — that response is passed straight through
from whatever the handler returns. Browsers only look at the headers on the
*real* response when deciding whether to expose it to JS, so every Lambda
proxy-integration response (success AND error) must include CORS headers
itself, or the browser blocks the response as a CORS failure even though
the request reached the server and returned 200.

Use `cors_headers()` (merged into any extra headers the handler adds, e.g.
Content-Type) on every `return` in every handler.
"""

import json
import os

# For a hackathon demo this is intentionally permissive ("*"). If the
# frontend origin needs to be locked down later, set the ALLOWED_ORIGIN
# environment variable on the Lambda function instead of hardcoding it here.
_DEFAULT_ALLOWED_ORIGIN = "*"


def cors_headers() -> dict:
    """Returns the standard CORS headers to merge into every response."""
    origin = os.environ.get("ALLOWED_ORIGIN", _DEFAULT_ALLOWED_ORIGIN)
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
    }


def json_response(status_code: int, body: dict) -> dict:
    """Builds an API Gateway proxy response with CORS + JSON headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            **cors_headers(),
        },
        "body": json.dumps(body, ensure_ascii=False),
    }
