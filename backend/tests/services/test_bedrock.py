"""Unit tests for src/services/bedrock.py's Converse API wrapper.

boto3's bedrock-runtime client is mocked so these tests run offline and
deterministically — no real Bedrock calls (see ai_chat.py's manual smoke
test notes for how this was validated against the real deployed model).
"""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from src.services.bedrock import BedrockChatClient, BedrockError


def _fake_text_response(text):
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": text}]}},
        "stopReason": "end_turn",
    }


def _fake_tool_use_response(tool_name, tool_input, tool_use_id="t1"):
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [
                    {"toolUse": {"toolUseId": tool_use_id, "name": tool_name, "input": tool_input}}
                ],
            }
        },
        "stopReason": "tool_use",
    }


@patch("boto3.client")
def test_chat_extracts_text_from_response(mock_boto_client):
    mock_client = MagicMock()
    mock_client.converse.return_value = _fake_text_response("你好，我是 AI 助理")
    mock_boto_client.return_value = mock_client

    client = BedrockChatClient()
    result = client.chat([{"role": "user", "content": [{"text": "hi"}]}])
    assert result == "你好，我是 AI 助理"


@patch("boto3.client")
def test_converse_raw_returns_full_response(mock_boto_client):
    mock_client = MagicMock()
    fake_response = _fake_tool_use_response("get_price", {"currency": "BTC"})
    mock_client.converse.return_value = fake_response
    mock_boto_client.return_value = mock_client

    client = BedrockChatClient()
    result = client.converse_raw([{"role": "user", "content": [{"text": "查價格"}]}])
    assert result["stopReason"] == "tool_use"
    assert result["output"]["message"]["content"][0]["toolUse"]["name"] == "get_price"


@patch("boto3.client")
def test_converse_raw_passes_tool_config(mock_boto_client):
    mock_client = MagicMock()
    mock_client.converse.return_value = _fake_text_response("ok")
    mock_boto_client.return_value = mock_client

    client = BedrockChatClient()
    tool_config = {"tools": [{"toolSpec": {"name": "foo", "inputSchema": {"json": {}}}}]}
    client.converse_raw([{"role": "user", "content": [{"text": "hi"}]}], tool_config=tool_config)

    call_kwargs = mock_client.converse.call_args.kwargs
    assert call_kwargs["toolConfig"] == tool_config


@patch("boto3.client")
def test_converse_raw_omits_tool_config_when_none(mock_boto_client):
    mock_client = MagicMock()
    mock_client.converse.return_value = _fake_text_response("ok")
    mock_boto_client.return_value = mock_client

    client = BedrockChatClient()
    client.converse_raw([{"role": "user", "content": [{"text": "hi"}]}])

    call_kwargs = mock_client.converse.call_args.kwargs
    assert "toolConfig" not in call_kwargs


@patch("boto3.client")
def test_converse_raw_retries_then_succeeds(mock_boto_client):
    mock_client = MagicMock()
    mock_client.converse.side_effect = [
        ClientError({"Error": {"Code": "ThrottlingException"}}, "Converse"),
        _fake_text_response("ok after retry"),
    ]
    mock_boto_client.return_value = mock_client

    with patch("time.sleep"):
        client = BedrockChatClient()
        result = client.chat([{"role": "user", "content": [{"text": "hi"}]}])
    assert result == "ok after retry"
    assert mock_client.converse.call_count == 2


@patch("boto3.client")
def test_converse_raw_raises_after_exhausting_retries(mock_boto_client):
    mock_client = MagicMock()
    mock_client.converse.side_effect = ClientError({"Error": {"Code": "ThrottlingException"}}, "Converse")
    mock_boto_client.return_value = mock_client

    with patch("time.sleep"):
        client = BedrockChatClient()
        with pytest.raises(BedrockError):
            client.chat([{"role": "user", "content": [{"text": "hi"}]}])
    assert mock_client.converse.call_count == 2
