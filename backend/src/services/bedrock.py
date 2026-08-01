"""AWS Bedrock Runtime client — wraps the Converse API.

Uses boto3 bedrock-runtime to call the model specified by the
BEDROCK_MODEL_ID environment variable. Retry policy: 3 attempts,
2-second delay — consistent with other service modules.

Environment variables:
    BEDROCK_MODEL_ID  — e.g. "openai.gpt-oss-120b-1:0"
    BEDROCK_REGION    — AWS region for Bedrock (default: us-west-2)
"""

import os
import time
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2

_DEFAULT_MODEL_ID = "openai.gpt-oss-120b-1:0"
_DEFAULT_REGION = "us-west-2"

# System prompt 放在 backend/src/prompts/system_prompt.txt
_PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"
_SYSTEM_PROMPT_FILE = _PROMPT_DIR / "system_prompt.txt"
_PERSONALITY_PROMPT_FILE = _PROMPT_DIR / "personality_prompt.txt"
_PERSONALITY_LONG_PROMPT_FILE = _PROMPT_DIR / "personality_long_prompt.txt"


class BedrockError(Exception):
    """Raised when Bedrock API returns an error or all retries are exhausted."""


def _load_system_prompt() -> str:
    """Read system prompt from file. Returns empty string if file missing."""
    try:
        return _SYSTEM_PROMPT_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def load_personality_prompt() -> str:
    """Read personality analysis prompt from file. Returns empty string if missing."""
    try:
        return _PERSONALITY_PROMPT_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def load_personality_long_prompt() -> str:
    """Read detailed personality analysis prompt from file. Returns empty string if missing."""
    try:
        return _PERSONALITY_LONG_PROMPT_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


class BedrockChatClient:
    """Thin wrapper around AWS Bedrock Runtime Converse API."""

    def __init__(
        self,
        model_id: Optional[str] = None,
        region: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 1.0,
        top_p: float = 0.5,
    ):
        self._model_id = model_id or os.environ.get("BEDROCK_MODEL_ID", _DEFAULT_MODEL_ID)
        self._region = region or os.environ.get("BEDROCK_REGION", _DEFAULT_REGION)
        self._max_tokens = max_tokens
        self._temperature = temperature
        self._top_p = top_p

        self._client = boto3.client(
            "bedrock-runtime",
            region_name=self._region,
        )

        self._system_prompt = _load_system_prompt()

    # ─────────────────────────────────────────────────────────────────────────
    # Public methods
    # ─────────────────────────────────────────────────────────────────────────

    def chat(self, messages: list[dict], system_prompt: "str | None" = None) -> str:
        """Send a conversation to Bedrock and return the assistant's reply
        as plain text. No tool use — for callers that just want a text
        response (e.g. save_personality.py / upload_csv.py's personality
        description generation).

        Args:
            messages: List of message dicts in Bedrock Converse format, e.g.
                [{"role": "user", "content": [{"text": "你好"}]}]
            system_prompt: Optional override for system prompt. If None, uses
                the default loaded from system_prompt.txt.

        Returns:
            The assistant's text response.

        Raises:
            BedrockError on failure after retries.
        """
        response = self.converse_raw(messages, system_prompt=system_prompt)
        return self._extract_text(response)

    def converse_raw(
        self,
        messages: list[dict],
        system_prompt: "str | None" = None,
        tool_config: "dict | None" = None,
    ) -> dict:
        """Send a conversation to Bedrock and return the full raw Converse
        API response (not just extracted text) — needed by callers that
        use Tool Use and must inspect `stopReason` / `toolUse` content
        blocks (see ai_tools.py / ai_chat.py's multi-round tool loop).

        Args:
            messages: List of message dicts in Bedrock Converse format.
            system_prompt: Optional override for system prompt.
            tool_config: Optional Bedrock `toolConfig` dict, e.g.
                {"tools": [{"toolSpec": {...}}, ...]}. Omit to disable tool use.

        Returns:
            The raw Converse API response dict (`output`, `stopReason`, etc).

        Raises:
            BedrockError on failure after retries.
        """
        kwargs: dict = {
            "modelId": self._model_id,
            "messages": messages,
            "inferenceConfig": {
                "maxTokens": self._max_tokens,
                "temperature": self._temperature,
                "topP": self._top_p,
            },
            "performanceConfig": {"latency": "standard"},
        }

        effective_prompt = system_prompt if system_prompt is not None else self._system_prompt
        if effective_prompt:
            kwargs["system"] = [{"text": effective_prompt}]

        if tool_config:
            kwargs["toolConfig"] = tool_config

        last_error: Optional[Exception] = None
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                return self._client.converse(**kwargs)
            except (ClientError, Exception) as exc:
                last_error = exc
                print(f"[BEDROCK] Attempt {attempt}/{RETRY_ATTEMPTS} failed: {exc}")
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS)

        raise BedrockError(
            f"Bedrock converse failed after {RETRY_ATTEMPTS} attempts: {last_error}"
        ) from last_error

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_text(response: dict) -> str:
        """Extract text content from the Converse API response."""
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])
        texts = [block["text"] for block in content_blocks if "text" in block]
        return "\n".join(texts)
