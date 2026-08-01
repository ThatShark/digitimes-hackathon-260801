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
