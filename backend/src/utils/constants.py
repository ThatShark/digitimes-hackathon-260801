"""Shared constants used across multiple handlers.

Single source of truth for "which coins does this product actually
support" — mirrors frontend/src/pages/MainPage.jsx's fixed 6-coin list.
Any handler that ranks/filters coins (market_overview.py, notifications.py)
should import from here instead of hardcoding its own list, so the two
stay in sync.
"""

# The only 6 currencies the product supports (matches MainPage.jsx's
# fixed coin card list). Any CMC listings data for symbols outside this
# set must be filtered out before showing "top movers" — otherwise coins
# the user can't actually see/trade on this product (e.g. ADA, DOT, PEPE)
# leak into gainers/losers rankings and notifications.
SUPPORTED_CURRENCIES = {"BTC", "ETH", "SOL", "DOGE", "USDT", "USDC"}

# Stablecoins within SUPPORTED_CURRENCIES. Their 24h % change is always
# ~0% and carries no signal, so they should be excluded from "top
# gainers/losers" and "price mover" ranking specifically (their price is
# still shown normally everywhere else, e.g. coin cards).
STABLECOIN_CURRENCIES = {"USDT", "USDC"}

# Currencies eligible for movement-based ranking (gainers/losers/price
# movers): supported minus stablecoins.
RANKABLE_CURRENCIES = SUPPORTED_CURRENCIES - STABLECOIN_CURRENCIES

# ─────────────────────────────────────────────────────────────────────────────
# Fund-flow analysis (資金流向分析) — size classification thresholds
# ─────────────────────────────────────────────────────────────────────────────
#
# There is no industry-standard definition of "large/medium/small order" —
# every data vendor (CoinGlass, various A-share tools, etc.) uses its own
# threshold. We classify by TWD trade value (not coin quantity or % of
# volume) so a threshold means the same "amount of money" regardless of
# which of the 6 supported coins the trade is in — a 0.01 BTC trade and a
# 10,000 DOGE trade are comparable if they're both worth ~NT$20,000.
#
# Chosen thresholds (single trade value, TWD):
#   特大單 (extra-large): >= 1,000,000
#   大單   (large):        200,000 – 999,999
#   中單   (medium):        30,000 – 199,999
#   小單   (small):         < 30,000
#
# Rationale: NT$1,000,000 (~US$30k) is a size an ordinary retail trader
# rarely places in one order, a reasonable "whale-ish" cutoff. NT$30,000
# (~US$1k) is roughly a typical single retail trade size, below which is
# clearly "small". These are deliberately kept as named constants (not
# hardcoded numbers) so they can be tuned without touching handler logic.
FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD = 1_000_000
FUND_FLOW_LARGE_THRESHOLD_TWD = 200_000
FUND_FLOW_MEDIUM_THRESHOLD_TWD = 30_000
