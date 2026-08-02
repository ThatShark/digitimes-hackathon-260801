"""Tool definitions + dispatcher for the AI chat assistant's Bedrock Tool Use.

Gives the AI 5 tools it can call during a conversation (POST /ai_chat):
  - get_current_price        : real-time price for the currency the user is viewing (MAX)
  - get_fear_greed_index     : current Fear & Greed Index (CoinMarketCap)
  - get_fund_flow_analysis   : 資金流向分析 (real MAX trades classified into buckets, see market_fund_flow.py)
  - get_technical_indicators : 技術指標 (MACD/RSI/MA/Bollinger/KDJ from MAX K-line data)
  - propose_trade            : the AI's own decision to surface a structured buy/sell suggestion

The model decides for itself whether/which tools to call before answering
(Bedrock Converse Tool Use) — this replaces the previous design where the
backend unconditionally fetched price + Fear&Greed data on every request
regardless of whether the question needed it, and separately tried to
regex/keyword-match a trade suggestion out of the AI's free-form text.

`amount_twd` in propose_trade's schema is spelled out (not just "amount")
and its description repeats "TWD 金額，不是幣的數量" specifically because a
smoke test against openai.gpt-oss-120b-1:0 showed the model will confuse
"amount" with "coin quantity" if the field name/description is ambiguous
(observed producing a value like 0.0192 instead of a TWD amount when the
field was just called "amount").

The currency for get_current_price / get_fund_flow_analysis / propose_trade
is NOT a tool parameter — it's always the currency the user is currently
viewing (passed in as `current_currency` to build_tool_config()/execute_tool()),
per product decision: AI trade suggestions are scoped to the page the user
is on, not any currency mentioned in conversation.
"""

from src.handlers.market_fund_flow import get_fund_flow_data
from src.services.coinmarketcap import CoinMarketCapClient, CoinMarketCapError
from src.services.max_api import MaxApiClient, MaxApiError
from src.utils.indicators import compute_indicators

# Tool name constants (avoid typos when comparing toolUse.name elsewhere)
TOOL_GET_CURRENT_PRICE = "get_current_price"
TOOL_GET_FEAR_GREED_INDEX = "get_fear_greed_index"
TOOL_GET_FUND_FLOW_ANALYSIS = "get_fund_flow_analysis"
TOOL_GET_TECHNICAL_INDICATORS = "get_technical_indicators"
TOOL_GET_HISTORICAL_MARKET_DATA = "get_historical_market_data"
TOOL_PROPOSE_TRADE = "propose_trade"

_TRADE_TOOL_NAMES = {TOOL_GET_CURRENT_PRICE, TOOL_GET_FUND_FLOW_ANALYSIS}


def build_tool_config(current_currency: "str | None") -> dict:
    """Build the Bedrock `toolConfig` dict for POST /ai_chat.

    get_current_price / get_fund_flow_analysis are only offered if the
    request has a `current_currency` (i.e. the user is on a specific
    coin's page) — there's nothing for them to query otherwise.
    propose_trade is likewise only offered when a currency is set, since a
    trade suggestion with no currency to buy/sell makes no sense.
    """
    tools = [
        {
            "toolSpec": {
                "name": TOOL_GET_FEAR_GREED_INDEX,
                "description": (
                    "取得目前市場的恐懼貪婪指數（Fear & Greed Index，0-100 分）。"
                    "適合在使用者詢問市場情緒、是否是進場/出場時機、或整體大盤氣氛時呼叫。"
                ),
                "inputSchema": {"json": {"type": "object", "properties": {}}},
            }
        },
        {
            "toolSpec": {
                "name": TOOL_GET_HISTORICAL_MARKET_DATA,
                "description": (
                    "取得某個幣種在指定歷史時間範圍內的 K 線數據和技術指標。"
                    "適合在使用者詢問過去某段時間的市場表現、為什麼某段時間漲跌、"
                    "回顧歷史走勢、或分析某個特定日期前後的行情時呼叫。"
                    "例如：「BTC 上個月為什麼暴跌」「ETH 三月份的走勢如何」"
                    "「SOL 一週前的技術指標」。"
                    "返回該時間範圍內的 OHLCV 摘要（開/高/低/收/量）、漲跌幅、"
                    "以及該時段結束時的技術指標（MA/MACD/RSI/Bollinger/KDJ）。"
                ),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "currency": {
                                "type": "string",
                                "description": (
                                    "幣種代碼，大寫。例如 BTC、ETH、SOL、DOGE。"
                                    "如果使用者沒有明確提到幣種，使用他目前正在查看的幣種。"
                                ),
                            },
                            "start_date": {
                                "type": "string",
                                "description": (
                                    "查詢起始日期，格式 YYYY-MM-DD。"
                                    "例如使用者說「上個月」，就用上個月第一天的日期。"
                                    "說「一週前」就用 7 天前的日期。"
                                ),
                            },
                            "end_date": {
                                "type": "string",
                                "description": (
                                    "查詢結束日期，格式 YYYY-MM-DD。"
                                    "例如使用者說「上個月」，就用上個月最後一天。"
                                    "說「一週前」就用今天的日期。"
                                    "如果未指定，預設為今天。"
                                ),
                            },
                            "timeframe": {
                                "type": "string",
                                "enum": ["1h", "4h", "1d"],
                                "description": (
                                    "K 線時間週期。短期（幾天內）用 1h，"
                                    "中期（1-2 週）用 4h，長期（超過 2 週）用 1d。"
                                    "預設根據查詢範圍自動選擇。"
                                ),
                            },
                        },
                        "required": ["currency", "start_date"],
                    }
                },
            }
        },
    ]

    if current_currency:
        tools.append({
            "toolSpec": {
                "name": TOOL_GET_CURRENT_PRICE,
                "description": (
                    f"取得使用者目前正在查看的幣種（{current_currency}）的即時價格與 24 小時漲跌幅。"
                    "適合在需要知道目前價格、近期漲跌幅時呼叫。"
                ),
                "inputSchema": {"json": {"type": "object", "properties": {}}},
            }
        })
        tools.append({
            "toolSpec": {
                "name": TOOL_GET_FUND_FLOW_ANALYSIS,
                "description": (
                    f"取得使用者目前正在查看的幣種（{current_currency}）的資金流向分析——"
                    "近期真實成交依金額分類的特大單/大單/中單/小單買賣量，以及近 7 日淨資金流向。"
                    "適合在使用者詢問資金流向、大戶動向、買賣力道時呼叫。"
                ),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "period": {
                                "type": "string",
                                "enum": ["5m", "1h", "4h", "1d"],
                                "description": "分析近期多久以內的成交紀錄，預設 1h",
                            }
                        },
                    }
                },
            }
        })
        tools.append({
            "toolSpec": {
                "name": TOOL_GET_TECHNICAL_INDICATORS,
                "description": (
                    f"取得使用者目前正在查看的幣種（{current_currency}）的技術指標分析，"
                    "包含 MA（7/25/99 均線趨勢）、MACD（金叉/死叉）、RSI（超買/超賣）、"
                    "布林帶（價格在帶中的位置）、KDJ（隨機指標）。"
                    "適合在使用者詢問技術面分析、趨勢判斷、是否超買超賣、"
                    "進出場時機、或需要綜合技術面判斷來支持交易建議時呼叫。"
                ),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "timeframe": {
                                "type": "string",
                                "enum": ["1h", "4h", "1d"],
                                "description": (
                                    "K 線時間週期。1h=小時線（短期）、"
                                    "4h=四小時線（中期）、1d=日線（中長期）。"
                                    "預設 4h，適合大多數分析場景。"
                                ),
                            }
                        },
                    }
                },
            }
        })
        tools.append({
            "toolSpec": {
                "name": TOOL_PROPOSE_TRADE,
                "description": (
                    f"當你根據分析認為使用者目前查看的幣種（{current_currency}）適合買入或賣出時，"
                    "呼叫這個工具提出具體、結構化的交易建議。"
                    "只在你有實際分析依據（例如恐懼貪婪指數、即時價格、資金流向、"
                    "使用者的投資人格與歷史交易金額）支持這個建議時才呼叫，"
                    "不要沒有分析就隨意呼叫。"
                ),
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["buy", "sell"],
                                "description": "建議買入或賣出",
                            },
                            "amount_twd": {
                                "type": "number",
                                "description": (
                                    "建議交易的台幣金額（TWD），不是幣的數量、不是百分比。"
                                    "例如 5000 代表建議花費 NT$5,000。"
                                    "請參考使用者的歷史平均單筆交易金額（若有提供）來決定合理的金額，"
                                    "金額不宜過度偏離使用者平時的交易習慣。"
                                ),
                            },
                            "reason": {
                                "type": "string",
                                "description": (
                                    "用繁體中文，向使用者說明為什麼適合這筆交易、"
                                    "以及為什麼建議這個金額。這段文字會直接顯示給使用者看，"
                                    "所以要完整、口語化，不要只是內部筆記。"
                                ),
                            },
                        },
                        "required": ["action", "amount_twd", "reason"],
                    }
                },
            }
        })

    return {"tools": tools}


def execute_tool(tool_name: str, tool_input: dict, current_currency: "str | None") -> dict:
    """Execute a single tool call and return a JSON-serializable result dict
    to feed back to Bedrock as a toolResult. Never raises — on any failure,
    returns {"error": "..."} so the model can decide how to proceed (e.g.
    apologize, answer without that data, or try a different tool) instead
    of the whole conversation turn failing.

    `propose_trade` is handled specially by the caller (ai_chat.py) — it's
    not "executed" against an external API, it's the model's own decision
    surfaced as data. If it reaches here (it shouldn't, callers should
    intercept it first), we just echo the input back.
    """
    try:
        if tool_name == TOOL_GET_CURRENT_PRICE:
            return _get_current_price(current_currency)
        if tool_name == TOOL_GET_FEAR_GREED_INDEX:
            return _get_fear_greed_index()
        if tool_name == TOOL_GET_FUND_FLOW_ANALYSIS:
            period = tool_input.get("period") or "1h"
            return _get_fund_flow_analysis(current_currency, period)
        if tool_name == TOOL_GET_TECHNICAL_INDICATORS:
            timeframe = tool_input.get("timeframe") or "4h"
            return _get_technical_indicators(current_currency, timeframe)
        if tool_name == TOOL_GET_HISTORICAL_MARKET_DATA:
            return _get_historical_market_data(tool_input, current_currency)
        if tool_name == TOOL_PROPOSE_TRADE:
            return dict(tool_input)
        return {"error": f"未知的工具名稱: {tool_name}"}
    except Exception as exc:  # noqa: BLE001 - tool execution must never crash the chat loop
        print(f"[AI_TOOLS] {tool_name} failed: {exc}")
        return {"error": f"{tool_name} 執行失敗，暫時無法取得這項資料"}


# ─────────────────────────────────────────────────────────────────────────────
# Individual tool implementations
# ─────────────────────────────────────────────────────────────────────────────

def _get_current_price(currency: "str | None") -> dict:
    if not currency:
        return {"error": "沒有指定幣種"}
    client = MaxApiClient()
    try:
        ticker = client.get_ticker(f"{currency.lower()}twd")
    except MaxApiError:
        return {"error": "無法取得即時價格"}
    if not isinstance(ticker, dict) or "last" not in ticker:
        return {"error": f"找不到市場 {currency}TWD"}

    last = float(ticker.get("last", 0))
    open_price = float(ticker.get("open", 0))
    change_pct = ((last - open_price) / open_price * 100) if open_price else 0.0
    return {
        "currency": currency,
        "last_price_twd": last,
        "open_24h_twd": open_price,
        "high_24h_twd": float(ticker.get("high", 0)),
        "low_24h_twd": float(ticker.get("low", 0)),
        "change_24h_pct": round(change_pct, 2),
        "volume_24h": float(ticker.get("vol", 0)),
    }


def _get_fear_greed_index() -> dict:
    client = CoinMarketCapClient()
    try:
        raw = client.get_fear_greed_latest()
    except CoinMarketCapError:
        return {"error": "無法取得恐懼貪婪指數"}
    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, dict) or "value" not in data:
        return {"error": "恐懼貪婪指數回應格式異常"}
    return {
        "value": int(data["value"]),
        "classification": data.get("value_classification", ""),
        "update_time": data.get("update_time", ""),
    }


def _get_fund_flow_analysis(currency: "str | None", period: str) -> dict:
    if not currency:
        return {"error": "沒有指定幣種"}
    if period not in ("5m", "1h", "4h", "1d"):
        period = "1h"
    try:
        return get_fund_flow_data(currency, "TWD", period)
    except MaxApiError:
        return {"error": "無法取得資金流向資料"}


def _get_technical_indicators(currency: "str | None", timeframe: str) -> dict:
    """Fetch K-line data from MAX and compute technical indicators."""
    if not currency:
        return {"error": "沒有指定幣種"}

    # Map timeframe to MAX API period (minutes)
    period_map = {"1h": 60, "4h": 240, "1d": 1440}
    period_minutes = period_map.get(timeframe, 240)

    # Need ~100 candles for reliable indicator calculation (RSI needs 15+,
    # MACD needs 35+, MA99 needs 99+, so 100 is a good baseline)
    limit = 100

    client = MaxApiClient()
    try:
        candles = client.get_klines(
            market=f"{currency.lower()}twd",
            period=period_minutes,
            limit=limit,
        )
    except MaxApiError:
        return {"error": f"無法取得 {currency} 的 K 線資料"}

    if not candles or not isinstance(candles, list):
        return {"error": f"找不到 {currency}TWD 的 K 線數據"}

    indicators = compute_indicators(candles)
    if "error" in indicators:
        return indicators

    # Add metadata
    indicators["currency"] = currency
    indicators["timeframe"] = timeframe
    indicators["candles_used"] = len(candles)

    return indicators


def _get_historical_market_data(tool_input: dict, current_currency: "str | None") -> dict:
    """Fetch historical K-line data for a specified date range and compute
    technical indicators at the end of that range.

    This gives the AI the ability to answer questions like:
      - "BTC 上個月為什麼暴跌？"
      - "ETH 三月份的走勢如何？"
      - "SOL 一週前的技術面怎麼樣？"

    Returns OHLCV summary for the range, price change, and indicators
    computed from the candles ending at end_date.
    """
    import time as _time
    from datetime import datetime, timedelta, timezone

    currency = (tool_input.get("currency") or current_currency or "").strip().upper()
    if not currency:
        return {"error": "沒有指定幣種"}

    start_date_str = (tool_input.get("start_date") or "").strip()
    end_date_str = (tool_input.get("end_date") or "").strip()

    if not start_date_str:
        return {"error": "必須指定 start_date（格式 YYYY-MM-DD）"}

    # Parse dates
    try:
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return {"error": f"start_date 格式錯誤：{start_date_str}，請使用 YYYY-MM-DD"}

    if end_date_str:
        try:
            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return {"error": f"end_date 格式錯誤：{end_date_str}，請使用 YYYY-MM-DD"}
    else:
        end_dt = datetime.now(timezone.utc)

    # Validate range
    if end_dt < start_dt:
        return {"error": "end_date 不能早於 start_date"}

    range_days = (end_dt - start_dt).days
    if range_days > 365:
        return {"error": "查詢範圍最多 365 天"}

    # Auto-select timeframe based on range if not specified
    timeframe = (tool_input.get("timeframe") or "").strip()
    if not timeframe:
        if range_days <= 3:
            timeframe = "1h"
        elif range_days <= 14:
            timeframe = "4h"
        else:
            timeframe = "1d"

    # Map timeframe to MAX API period (minutes)
    period_map = {"1h": 60, "4h": 240, "1d": 1440}
    period_minutes = period_map.get(timeframe, 1440)

    # Calculate how many candles we need
    range_minutes = range_days * 24 * 60
    candles_needed = min(range_minutes // period_minutes + 1, 1000)  # MAX API cap ~10000 but keep reasonable
    # Request extra candles before start_date for indicator warm-up (MA99 needs 99 candles)
    warmup_candles = 100
    total_limit = min(candles_needed + warmup_candles, 2000)

    # Convert start_date to unix timestamp for MAX API
    # We start earlier to allow indicator warm-up
    warmup_offset = timedelta(minutes=period_minutes * warmup_candles)
    fetch_start_ts = int((start_dt - warmup_offset).timestamp())

    client = MaxApiClient()
    market = f"{currency.lower()}twd"

    try:
        candles = client.get_klines(
            market=market,
            period=period_minutes,
            limit=total_limit,
            timestamp=fetch_start_ts,
        )
    except MaxApiError:
        return {"error": f"無法取得 {currency} 的歷史 K 線資料"}

    if not candles or not isinstance(candles, list) or len(candles) < 2:
        return {"error": f"找不到 {currency}TWD 在該時間範圍的 K 線數據"}

    # Filter candles to the requested date range for OHLCV summary
    start_ts = int(start_dt.timestamp())
    end_ts = int((end_dt + timedelta(days=1)).timestamp())  # inclusive end date

    range_candles = [c for c in candles if start_ts <= c[0] < end_ts]

    if not range_candles:
        return {"error": f"在 {start_date_str} ~ {end_date_str or '今天'} 範圍內找不到 K 線數據"}

    # Compute OHLCV summary for the range
    opens = [float(c[1]) for c in range_candles]
    highs = [float(c[2]) for c in range_candles]
    lows = [float(c[3]) for c in range_candles]
    closes = [float(c[4]) for c in range_candles]
    volumes = [float(c[5]) for c in range_candles]

    range_open = opens[0]
    range_close = closes[-1]
    range_high = max(highs)
    range_low = min(lows)
    total_volume = sum(volumes)
    change_pct = ((range_close - range_open) / range_open * 100) if range_open else 0.0

    # Find max drawdown and max rally within the range
    peak = opens[0]
    max_drawdown_pct = 0.0
    for close in closes:
        if close > peak:
            peak = close
        drawdown = ((peak - close) / peak * 100) if peak else 0.0
        if drawdown > max_drawdown_pct:
            max_drawdown_pct = drawdown

    trough = opens[0]
    max_rally_pct = 0.0
    for close in closes:
        if close < trough:
            trough = close
        rally = ((close - trough) / trough * 100) if trough else 0.0
        if rally > max_rally_pct:
            max_rally_pct = rally

    # Compute technical indicators using ALL candles up to end_date
    # (includes warm-up candles before start_date for accurate calculation)
    indicator_candles = [c for c in candles if c[0] < end_ts]
    indicators = {}
    if len(indicator_candles) >= 30:
        indicators = compute_indicators(indicator_candles)
        if "error" in indicators:
            indicators = {}

    # Build result
    result = {
        "currency": currency,
        "period": f"{start_date_str} ~ {end_date_str or '今天'}",
        "timeframe": timeframe,
        "candles_in_range": len(range_candles),
        "price_summary": {
            "open_twd": round(range_open, 2),
            "close_twd": round(range_close, 2),
            "high_twd": round(range_high, 2),
            "low_twd": round(range_low, 2),
            "change_pct": round(change_pct, 2),
            "total_volume": round(total_volume, 4),
        },
        "volatility": {
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "max_rally_pct": round(max_rally_pct, 2),
            "price_range_pct": round(((range_high - range_low) / range_low * 100) if range_low else 0, 2),
        },
    }

    if indicators:
        result["indicators_at_end"] = indicators

    return result
