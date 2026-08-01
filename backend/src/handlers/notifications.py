"""Notifications Lambda handler.

Implements GET /notifications per backend/api.yaml operationId
getNotifications. Powers the top notification banner
(NotificationBanner.jsx) with dynamically generated alerts instead of a
hardcoded string list.

Design: this endpoint has NO persistence/scheduling — every call runs the
rule set against live CoinMarketCap data and returns whatever currently
matches. This is the "simple version" tradeoff discussed with the user:
a scheduled Lambda writing to S3 would avoid recomputing on every request,
but for a hackathon MVP the extra EventBridge + S3 plumbing isn't worth it
when the CMC calls are already fast and already used by market_overview.py.

Four notification types (see NotificationItem.type in api.yaml):
    price_mover  — real: any top-100-by-market-cap coin whose 24h % change
                   exceeds ±price_change_threshold (reuses the same
                   ranking-pool approach as market_overview.py to avoid
                   surfacing meaningless microcap swings).
    fear_greed   — real: the current Fear & Greed Index classification.
    whale_alert  — mock: no real on-chain data source exists yet (see
                   .kiro/steering/platform-features.md). Deterministically
                   seeded from the current hour so it doesn't reroll on
                   every request within the same hour, but is NOT derived
                   from any live external data — purely illustrative.
    social_buzz  — mock: same caveat as whale_alert; no real community
                   activity metric is wired up yet.

Never returns an error for partial CMC failures — a missing notification
is not worth failing the endpoint over. Only truly invalid query
parameters return 400.
"""

import random
import time

from src.services.coinmarketcap import CoinMarketCapClient, CoinMarketCapError
from src.utils.http import json_response

_DEFAULT_THRESHOLD = 10.0
_DEFAULT_LIMIT = 8
_RANKING_POOL_SIZE = 100  # same rationale as market_overview.py

_FEAR_GREED_LABELS_ZH = {
    "Extreme Fear": "極度恐慌",
    "Fear": "恐慌",
    "Neutral": "中性",
    "Greed": "貪婪",
    "Extreme Greed": "極度貪婪",
}

# Mock pools for the two alert types with no real data source yet.
# Kept short and clearly generic — these are illustrative, not factual.
_MOCK_WHALE_ALERTS = [
    "🐋 巨鯨警報：500 BTC 從冷錢包轉入交易所",
    "🐋 巨鯨警報：一筆 2,000 ETH 轉帳流向未知錢包",
    "🐋 巨鯨警報：大戶錢包新增 1,200 萬 USDT",
]
_MOCK_SOCIAL_ALERTS = [
    ("SOL", "🔥 {symbol} 鏈上活躍度創 30 天新高"),
    ("PEPE", "📈 {symbol} 社群討論量暴增"),
    ("DOGE", "💬 {symbol} 社群情緒轉為樂觀"),
]


def lambda_handler(event, context):
    """GET /notifications"""
    params = event.get("queryStringParameters") or {}

    try:
        threshold = float(params.get("price_change_threshold", _DEFAULT_THRESHOLD))
        if not (1 <= threshold <= 100):
            raise ValueError
    except (TypeError, ValueError):
        return _error(400, "price_change_threshold 必須介於 1 到 100 之間")

    try:
        limit = int(params.get("limit", _DEFAULT_LIMIT))
        if not (1 <= limit <= 20):
            raise ValueError
    except (TypeError, ValueError):
        return _error(400, "limit 必須介於 1 到 20 之間")

    client = CoinMarketCapClient()
    now = int(time.time())

    notifications = []
    notifications.extend(_price_mover_notifications(client, threshold, now))
    notifications.extend(_fear_greed_notification(client, now))
    notifications.extend(_mock_notifications(now))

    return json_response(200, {
        "status": "ready",
        "notifications": notifications[:limit],
    })


# ─────────────────────────────────────────────────────────────────────────────
# Rule: price_mover — real data, reuses market_overview.py's ranking-pool
# approach to avoid surfacing meaningless microcap swings.
# ─────────────────────────────────────────────────────────────────────────────

def _price_mover_notifications(client: CoinMarketCapClient, threshold: float, now: int) -> list:
    try:
        raw = client.get_listings(
            start=1, limit=_RANKING_POOL_SIZE, convert="USD", sort="market_cap",
        )
    except CoinMarketCapError:
        return []

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, list):
        return []

    candidates = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        symbol = entry.get("symbol")
        change = _extract_usd_quote_field(entry, "percent_change_24h")
        if symbol is None or change is None or abs(change) < threshold:
            continue
        candidates.append((symbol, change))

    # Largest absolute movers first — those are the most noteworthy.
    candidates.sort(key=lambda c: abs(c[1]), reverse=True)

    results = []
    for symbol, change in candidates:
        direction = "漲幅" if change >= 0 else "跌幅"
        icon = "📈" if change >= 0 else "📉"
        results.append({
            "id": f"price_mover-{symbol}-{now}",
            "type": "price_mover",
            "icon": icon,
            "text": f"{symbol} 24H {direction} {change:+.1f}%，注意波動",
            "created_at": _iso(now),
        })
    return results


def _extract_usd_quote_field(entry: dict, field: str) -> "float | None":
    """CMC's keyless listings endpoint returns `quote` as a LIST of
    per-currency objects, not a dict keyed by currency code. Find the USD
    entry by its "symbol" field (see market_overview.py for the same quirk).
    """
    quote = entry.get("quote")
    if not isinstance(quote, list):
        return None
    for q in quote:
        if isinstance(q, dict) and q.get("symbol") == "USD":
            try:
                return float(q.get(field))
            except (TypeError, ValueError):
                return None
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Rule: fear_greed — real data
# ─────────────────────────────────────────────────────────────────────────────

def _fear_greed_notification(client: CoinMarketCapClient, now: int) -> list:
    try:
        raw = client.get_fear_greed_latest()
    except CoinMarketCapError:
        return []

    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, dict) or "value" not in data:
        return []

    try:
        value = int(data["value"])
    except (TypeError, ValueError):
        return []

    classification = data.get("value_classification", "")
    label_zh = _FEAR_GREED_LABELS_ZH.get(classification, classification)
    hint = "歷史上是進場好時機" if value <= 40 else "歷史上是出場好時機" if value >= 70 else "市場情緒中性"

    return [{
        "id": f"fear_greed-{now}",
        "type": "fear_greed",
        "icon": "📊",
        "text": f"恐懼貪婪指數為 {value}（{label_zh}），{hint}",
        "created_at": _iso(now),
    }]


# ─────────────────────────────────────────────────────────────────────────────
# Mock notifications — no real data source yet (whale/social).
# Deterministically seeded by the current hour so results are stable within
# an hour rather than rerolling on every request, while still being
# obviously not derived from live external data.
# ─────────────────────────────────────────────────────────────────────────────

def _mock_notifications(now: int) -> list:
    hour_bucket = now // 3600
    rng = random.Random(hour_bucket)

    whale_text = rng.choice(_MOCK_WHALE_ALERTS)
    symbol, template = rng.choice(_MOCK_SOCIAL_ALERTS)
    social_text = template.format(symbol=symbol)

    return [
        {
            "id": f"whale_alert-{hour_bucket}",
            "type": "whale_alert",
            "icon": "🐋",
            "text": whale_text,
            "created_at": _iso(now),
        },
        {
            "id": f"social_buzz-{hour_bucket}",
            "type": "social_buzz",
            "icon": "🔥",
            "text": social_text,
            "created_at": _iso(now),
        },
    ]


def _iso(unix_seconds: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(unix_seconds))


def _error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"status": "error", "message": message})
