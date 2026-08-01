"""Unit tests for the POST /ai_chat Lambda handler's multi-round Tool Use loop.

Bedrock (via BedrockChatClient.converse_raw) and S3 are mocked so these
tests run offline and deterministically. See ai_chat.py's module docstring
for how this flow was additionally smoke-tested end-to-end against the
real deployed Bedrock model + MAX/CMC APIs (not part of the automated
suite, but documented there for reference).
"""

import json
from unittest.mock import patch

from src.handlers import ai_chat
from src.services.bedrock import BedrockError


def _event(message, currency=None, before_messages=None, query_params=None):
    body = {"message": message}
    if currency:
        body["currency"] = currency
    if before_messages:
        body["before_messages"] = before_messages
    return {"body": json.dumps(body), "queryStringParameters": query_params or {}}


def _text_response(text):
    return {"output": {"message": {"role": "assistant", "content": [{"text": text}]}}, "stopReason": "end_turn"}


def _tool_use_response(tool_name, tool_input, tool_use_id="t1"):
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [{"toolUse": {"toolUseId": tool_use_id, "name": tool_name, "input": tool_input}}],
            }
        },
        "stopReason": "tool_use",
    }


# ── Validation ────────────────────────────────────────────────────────────────

def test_missing_message_returns_400():
    resp = ai_chat.lambda_handler({"body": json.dumps({}), "queryStringParameters": {}}, None)
    assert resp["statusCode"] == 400


def test_empty_message_returns_400():
    resp = ai_chat.lambda_handler(_event("   "), None)
    assert resp["statusCode"] == 400


def test_invalid_json_body_returns_400():
    resp = ai_chat.lambda_handler({"body": "not json", "queryStringParameters": {}}, None)
    assert resp["statusCode"] == 400


# ── No tool use: direct text answer ──────────────────────────────────────────

@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_direct_answer_no_tool_use(mock_converse, mock_personality, mock_avg):
    mock_converse.return_value = _text_response("恐懼貪婪指數是市場情緒指標...")
    resp = ai_chat.lambda_handler(_event("什麼是恐懼貪婪指數？"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["message"] == "恐懼貪婪指數是市場情緒指標..."
    assert body["investment_suggestion"] is None
    assert mock_converse.call_count == 1


# ── Tool use: single round then final answer ─────────────────────────────────

@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat, "execute_tool")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_single_tool_call_then_final_answer(mock_converse, mock_execute, mock_personality, mock_avg):
    mock_converse.side_effect = [
        _tool_use_response("get_fear_greed_index", {}),
        _text_response("目前恐懼貪婪指數為 22，市場恐慌。"),
    ]
    mock_execute.return_value = {"value": 22, "classification": "Extreme Fear"}

    resp = ai_chat.lambda_handler(_event("現在市場情緒怎樣？", "BTC"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert "22" in body["message"]
    assert body["investment_suggestion"] is None
    assert mock_converse.call_count == 2
    mock_execute.assert_called_once_with("get_fear_greed_index", {}, "BTC")


# ── propose_trade produces investment_suggestion ─────────────────────────────

@patch.object(ai_chat, "_load_avg_trade_amount", return_value=21000.0)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat, "execute_tool")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_propose_trade_produces_suggestion(mock_converse, mock_execute, mock_personality, mock_avg):
    mock_converse.side_effect = [
        _tool_use_response("propose_trade", {"action": "buy", "amount_twd": 21000, "reason": "市場恐慌，適合逢低買入"}),
        _text_response("建議您以 NT$21,000 買入 BTC。"),
    ]

    resp = ai_chat.lambda_handler(_event("我該買BTC嗎？", "BTC"), None)
    body = json.loads(resp["body"])
    assert body["investment_suggestion"] == {"currency": "BTC", "action": "buy", "amount": 21000}
    # propose_trade must NOT be routed through execute_tool (it's the model's
    # own decision, not an external API call)
    mock_execute.assert_not_called()


@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_no_suggestion_without_currency_even_if_propose_trade_called(mock_converse, mock_personality, mock_avg):
    """propose_trade shouldn't even be offered without a currency (see
    ai_tools.build_tool_config), but defensively: if somehow returned, the
    suggestion is dropped since there's no currency to scope it to."""
    mock_converse.side_effect = [
        _tool_use_response("propose_trade", {"action": "buy", "amount_twd": 1000, "reason": "x"}),
        _text_response("without currency context"),
    ]
    resp = ai_chat.lambda_handler(_event("幫我看看要不要買"), None)
    body = json.loads(resp["body"])
    assert body["investment_suggestion"] is None


# ── Multi-round tool use ─────────────────────────────────────────────────────

@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat, "execute_tool")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_multiple_tool_calls_across_rounds(mock_converse, mock_execute, mock_personality, mock_avg):
    mock_converse.side_effect = [
        _tool_use_response("get_fear_greed_index", {}, "t1"),
        _tool_use_response("get_current_price", {}, "t2"),
        _text_response("綜合分析後..."),
    ]
    mock_execute.side_effect = [
        {"value": 22, "classification": "Extreme Fear"},
        {"last_price_twd": 2000000.0},
    ]

    resp = ai_chat.lambda_handler(_event("現在適合買嗎？", "BTC"), None)
    body = json.loads(resp["body"])
    assert body["message"] == "綜合分析後..."
    assert mock_converse.call_count == 3
    assert mock_execute.call_count == 2


@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat, "execute_tool")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_round_cap_returns_fallback_message(mock_converse, mock_execute, mock_personality, mock_avg):
    """If the model keeps calling tools past _MAX_TOOL_ROUNDS, the loop
    must stop and return a graceful fallback rather than hanging or
    erroring."""
    mock_converse.return_value = _tool_use_response("get_fear_greed_index", {})
    mock_execute.return_value = {"value": 50}

    resp = ai_chat.lambda_handler(_event("一直問工具", "BTC"), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert "暫時無法" in body["message"] or "無法" in body["message"]
    assert mock_converse.call_count == ai_chat._MAX_TOOL_ROUNDS


# ── Bedrock failure -> 503 ────────────────────────────────────────────────────

@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_bedrock_failure_returns_503(mock_converse, mock_personality, mock_avg):
    mock_converse.side_effect = BedrockError("all retries exhausted")
    resp = ai_chat.lambda_handler(_event("hi"), None)
    assert resp["statusCode"] == 503


# ── Conversation history handling ────────────────────────────────────────────

@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_before_messages_included_in_conversation(mock_converse, mock_personality, mock_avg):
    mock_converse.return_value = _text_response("好的")
    history = [{"user": "之前的問題", "ai": "之前的回答"}]
    ai_chat.lambda_handler(_event("新問題", before_messages=history), None)

    sent_messages = mock_converse.call_args[0][0]
    # history turn (user+assistant) + current user message
    assert len(sent_messages) == 3
    assert sent_messages[0] == {"role": "user", "content": [{"text": "之前的問題"}]}
    assert sent_messages[1] == {"role": "assistant", "content": [{"text": "之前的回答"}]}


@patch.object(ai_chat, "_load_avg_trade_amount", return_value=None)
@patch.object(ai_chat, "_load_personality_analysis", return_value="")
@patch.object(ai_chat.BedrockChatClient, "converse_raw")
def test_incomplete_history_turn_excluded(mock_converse, mock_personality, mock_avg):
    mock_converse.return_value = _text_response("ok")
    history = [{"user": "問題沒有回答"}]  # missing 'ai' key
    ai_chat.lambda_handler(_event("新問題", before_messages=history), None)

    sent_messages = mock_converse.call_args[0][0]
    assert len(sent_messages) == 1  # only the current message, incomplete turn dropped
