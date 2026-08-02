"""AI Strategy Lambda handler.

Implements POST /ai_strategy — uses Bedrock to generate recommended
strategy parameters based on the strategy type, symbol, and market context.

Request body:
{
  "strategy_type": "grid",   // grid | dca | martingale | arbitrage | basket | signal
  "symbol": "BTC",
  "user_id": "default_user"
}

Success response 200:
{
  "status": "ready",
  "params": { ... strategy-specific JSON params ... }
}
"""

import json
import os

from src.services.bedrock import BedrockChatClient, BedrockError
from src.services.max_api import MaxApiClient, MaxApiError
from src.services.s3_storage import S3StorageError, S3StorageService
from src.utils.http import json_response
from src.utils.metrics import TradeDataError, compute_avg_trade_amount, parse_trades_csv

_BUCKET_NAME_ENV_VAR = "TRADES_BUCKET_NAME"

_GRID_TEMPLATES_SCHEMA = {
    "description": "現貨網格策略 AI 推薦（短/中/長期）",
    "fields": {
        "short": "短期波動型 (7~20天)，包含 lowerPrice, upperPrice, gridCount, investment, gridMode, apy (預估年化收益字串如 '45.2%'), duration (如 '7~20 天')",
        "mid": "中期震盪型 (1~2個月)，包含 lowerPrice, upperPrice, gridCount, investment, gridMode, apy, duration",
        "long": "長期穩健型 (3~6個月)，包含 lowerPrice, upperPrice, gridCount, investment, gridMode, apy, duration",
    },
}

_STRATEGY_SCHEMAS = {
    "grid": {
        "description": "現貨網格策略（Spot Grid）",
        "fields": {
            "lowerPrice": "區間最低價 (TWD)",
            "upperPrice": "區間最高價 (TWD)",
            "gridCount": "網格數量 (2-150)",
            "investment": "投入金額 (TWD)",
            "gridMode": "網格模式 (arithmetic 或 geometric)",
        },
    },
    "grid_templates": {
        "description": "現貨網格策略 AI 推薦（短/中/長期三組）",
        "fields": _GRID_TEMPLATES_SCHEMA["fields"],
    },
    "dca": {
        "description": "DCA 定投策略（Dollar-Cost Averaging）",
        "fields": {
            "amountPerOrder": "每期投入金額 (TWD)",
            "frequency": "定投週期 (hourly/daily/weekly/monthly)",
            "targetProfit": "目標獲利止盈百分比 (可選, 數字)",
        },
    },
    "martingale": {
        "description": "馬丁格爾策略（Martingale）",
        "fields": {
            "baseOrder": "首單金額 (TWD)",
            "priceDrop": "加倉跌幅百分比",
            "volumeMultiplier": "加倉倍數",
            "maxSafetyOrders": "最大加倉次數",
            "takeProfit": "目標止盈率百分比",
        },
    },
    "arbitrage": {
        "description": "期現套利策略（Spot-Futures Arbitrage）",
        "fields": {
            "totalCapital": "總套利金額 (TWD)",
            "leverage": "合約槓桿倍數 (1-3)",
            "spreadLimit": "最大允許價差百分比",
        },
    },
    "basket": {
        "description": "幣幣組合/自動再平衡策略（Portfolio Rebalancing）",
        "fields": {
            "tokens": "幣種配置列表, 格式為 [{coin: 'BTC', weight: 50}, {coin: 'ETH', weight: 30}, ...]，權重總和必須為 100",
            "totalInvestment": "總投資金額 (TWD)",
            "rebalanceMode": "再平衡觸發方式 (time 或 deviation)",
            "rebalancePeriod": "再平衡週期 (daily/weekly/monthly, 僅 mode=time 時)",
            "deviationThreshold": "偏離門檻百分比 (僅 mode=deviation 時)",
        },
    },
    "signal": {
        "description": "技術訊號策略（Technical Signal Trading）",
        "fields": {
            "indicatorType": "指標類型 (rsi/macd/ma)",
            "timeframe": "K線週期 (1m/15m/1h/4h/1D)",
            "rsiPeriod": "RSI週期 (若選 rsi)",
            "rsiBuyBelow": "RSI超賣買入值 (若選 rsi)",
            "rsiSellAbove": "RSI超買賣出值 (若選 rsi)",
            "maFast": "快線週期 (若選 ma)",
            "maSlow": "慢線週期 (若選 ma)",
            "orderSize": "單次觸發下單金額 (TWD)",
            "takeProfit": "止盈百分比",
            "stopLoss": "止損百分比",
        },
    },
}


def lambda_handler(event, context):
    """POST /ai_strategy"""
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _error(400, "無法解析請求內容")

    strategy_type = (body.get("strategy_type") or "").strip().lower()
    symbol = (body.get("symbol") or "").strip().upper() or "BTC"
    user_id = body.get("user_id") or _extract_user_id(event)
    period = (body.get("period") or "").strip().lower()  # short/mid/long/all or empty

    # If period is 'all', use grid_templates mode regardless of strategy_type
    if period == "all" and strategy_type == "grid":
        strategy_type = "grid_templates"

    if strategy_type not in _STRATEGY_SCHEMAS:
        return _error(400, f"不支援的策略類型: {strategy_type}")

    schema = _STRATEGY_SCHEMAS[strategy_type]

    # Load user's avg trade amount for context
    avg_trade_amount = _load_avg_trade_amount(user_id)

    # Fetch live price for better recommendations
    current_price = _fetch_current_price(symbol)

    # Special handling for grid_templates (3 tiers)
    if strategy_type == "grid_templates":
        system_prompt = _build_grid_templates_prompt(symbol, avg_trade_amount, current_price)
    else:
        system_prompt = _build_system_prompt(strategy_type, schema, symbol, avg_trade_amount, current_price)

    user_message = (
        f"請根據 {symbol} 的當前市場狀況，為「{schema['description']}」推薦最佳參數設定。"
        f"直接回傳 JSON，不要任何其他文字。"
    )

    client = BedrockChatClient()
    messages = [{"role": "user", "content": [{"text": user_message}]}]

    try:
        response = client.converse_raw(messages, system_prompt=system_prompt)
        text = BedrockChatClient._extract_text(response)
    except BedrockError as exc:
        print(f"[AI_STRATEGY] Bedrock error: {exc}")
        return _error(503, "AI 服務暫時無法使用，請稍後再試")

    # Parse the JSON from AI response
    params = _extract_json(text)
    if params is None:
        return _error(500, "AI 回傳格式錯誤，無法解析")

    return json_response(200, {"status": "ready", "params": params})


def _build_grid_templates_prompt(symbol: str, avg_trade_amount: "float | None", current_price: "float | None") -> str:
    amount_ref = ""
    if avg_trade_amount:
        amount_ref = (
            f"\n用戶過去每筆交易平均金額約為 NT${avg_trade_amount:,.0f}，"
            f"請據此調整 investment 金額，不要建議遠超此金額的數字。"
        )
    else:
        amount_ref = "\n用戶無歷史交易紀錄，investment 金額請保守建議（NT$3,000~10,000 範圍）。"

    price_ref = ""
    if current_price:
        price_ref = (
            f"\n\n重要：{symbol} 目前即時價格約為 NT${current_price:,.0f}。"
            f"所有 lowerPrice 和 upperPrice 必須以此為基準設定合理區間。"
            f"例如短期區間可在當前價格 ±5%~10%，中期 ±10%~20%，長期 ±20%~40%。"
            f"絕對不可以設定偏離當前價格超過 50% 的區間。"
        )

    return (
        f"你是一個加密貨幣現貨網格策略推薦引擎。\n"
        f"目標幣種：{symbol}\n"
        f"{amount_ref}{price_ref}\n\n"
        f"你必須回傳一個 JSON 物件，包含 short、mid、long 三個 key，分別代表短期、中期、長期策略推薦。\n"
        f"每個 key 的 value 是一個物件，必須包含以下欄位：\n"
        f"  - lowerPrice: 區間最低價 (TWD 數字)\n"
        f"  - upperPrice: 區間最高價 (TWD 數字)\n"
        f"  - gridCount: 網格數量 (數字, 2-150)\n"
        f"  - investment: 投入金額 (TWD 數字)\n"
        f"  - gridMode: 網格模式 (字串: \"arithmetic\" 或 \"geometric\")\n"
        f"  - apy: 預估年化收益率 (字串, 如 \"45.2%\")\n"
        f"  - duration: 建議運行期間 (字串, 如 \"7~20 天\")\n\n"
        f"三組策略的差異：\n"
        f"  - short (短期波動型): 區間較窄、網格較密、年化較高但風險也較高，適合 7~20 天\n"
        f"  - mid (中期震盪型): 區間適中、網格適中，適合 1~2 個月\n"
        f"  - long (長期穩健型): 區間較寬、網格較多，年化較低但更穩健，適合 3~6 個月\n\n"
        f"嚴格規則：\n"
        f"1. 回傳必須是合法的 JSON 物件，不可包含任何 markdown 標記或額外文字\n"
        f"2. lowerPrice/upperPrice/gridCount/investment 必須是數字類型\n"
        f"3. gridMode/apy/duration 是字串類型\n"
        f"4. 根據 {symbol} 目前的市場價格和歷史波動範圍給出合理區間\n"
        f"5. 不要回傳 null 值\n"
    )


def _build_system_prompt(strategy_type: str, schema: dict, symbol: str, avg_trade_amount: "float | None", current_price: "float | None") -> str:
    fields_desc = "\n".join(f"  - {k}: {v}" for k, v in schema["fields"].items())

    amount_ref = ""
    if avg_trade_amount:
        amount_ref = (
            f"\n用戶過去每筆交易平均金額約為 NT${avg_trade_amount:,.0f}，"
            f"請據此調整金額相關參數，不要建議遠超此金額的數字。"
        )
    else:
        amount_ref = "\n用戶無歷史交易紀錄，金額相關參數請保守建議（NT$1,000~10,000 範圍）。"

    price_ref = ""
    if current_price:
        price_ref = (
            f"\n{symbol} 目前即時價格約為 NT${current_price:,.0f}。"
            f"所有價格相關參數必須以此為基準設定合理數值。"
        )

    return (
        f"你是一個加密貨幣量化策略參數推薦引擎。\n"
        f"目標幣種：{symbol}\n"
        f"策略類型：{schema['description']}\n"
        f"{amount_ref}{price_ref}\n\n"
        f"你必須回傳一個 JSON 物件，包含以下欄位（且僅包含這些欄位）：\n"
        f"{fields_desc}\n\n"
        f"嚴格規則：\n"
        f"1. 回傳必須是合法的 JSON 物件，不可包含任何 markdown 標記或額外文字\n"
        f"2. 所有數值必須是數字類型（不是字串），除了 gridMode/frequency/rebalanceMode/rebalancePeriod/indicatorType/timeframe 等枚舉值\n"
        f"3. 如果該欄位是陣列（如 tokens），回傳 JSON 陣列\n"
        f"4. 金額單位為台幣 (TWD)\n"
        f"5. 根據 {symbol} 的特性和市場常見波動範圍給出合理建議\n"
        f"6. 不要回傳 null 值\n"
    )


def _extract_json(text: str) -> "dict | None":
    """Try to parse JSON from the AI response, handling markdown code blocks."""
    text = text.strip()
    # Remove markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                return None
        return None


def _fetch_current_price(symbol: str) -> "float | None":
    """Best-effort fetch of the current TWD price from MAX API."""
    try:
        client = MaxApiClient()
        market = f"{symbol}twd".lower()
        ticker = client.get_ticker(market)
        last = ticker.get("last") if isinstance(ticker, dict) else None
        return float(last) if last else None
    except (MaxApiError, TypeError, ValueError):
        return None


def _load_avg_trade_amount(user_id: "str | None") -> "float | None":
    if not user_id:
        return None
    bucket = os.environ.get(_BUCKET_NAME_ENV_VAR, "")
    if not bucket:
        return None
    try:
        storage = S3StorageService(bucket_name=bucket)
        csv_bytes = storage.get_trades_csv(user_id)
        trades = parse_trades_csv(csv_bytes)
        avg = compute_avg_trade_amount(trades)
        return avg if avg > 0 else None
    except (S3StorageError, TradeDataError):
        return None


def _extract_user_id(event) -> "str | None":
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("user_id")
    if user_id:
        return user_id
    path_params = event.get("pathParameters") or {}
    return path_params.get("user_id")


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
