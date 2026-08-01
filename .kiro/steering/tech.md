# Tech Stack & Build System

## Frontend

- **Framework**: React + Vite (JavaScript)
- **Routing**: React Router (SPA, client-side routing)
- **Charting**: lightweight-charts (K-line / candlestick)
- **Danmaku**: Custom CSS animation implementation (pure CSS `@keyframes`, no library dependency)
- **UI Style**: Threads-style community feed, YouTube-style card grid, Bilibili-style danmaku
- **Location**: `frontend/src/`
- **Status**: MainPage, CoinTrendPage (K-line + danmaku + AI/community chat + real indicator calculations), ProfilePage, CommunityPage, QuestionnairePage all scaffolded with mock data; backend integration pending

## Backend (AWS Lambda)

- **Runtime**: AWS Lambda + API Gateway
- **Language**: Python
- **Location**: `backend/src/`
- **API spec**: `backend/api.yaml` (OpenAPI 3.0.3) — source of truth for the contract; check it before adding new handlers
- **Testing**: pytest + hypothesis (property-based tests independently re-derive each metric formula)
- **Implemented handlers**: `upload_csv.py` (raw CSV body → metrics → S3; empty body re-analyzes existing S3 CSV), `init.py` (lightweight CSV-exists check, no analysis), `get_personality.py` (read-only S3 lookup of previously-computed scores), `save_personality.py` (save questionnaire-derived scores), `portfolio.py` (S3 CSV → FIFO open positions → live MAX price → holdings/P&L), `trade_history.py` (S3 CSV → trade summary + per-transaction history), `coin_price.py` (MAX ticker), `fear_greed.py` (CoinMarketCap latest/historical), `market_overview.py` (行情看板: Fear&Greed + dominance + market cap/volume + gainers/losers), `candlestick_chart.py` (MAX K-line + S3 CSV buy/sell markers merged), `notifications.py` (dynamic NotificationBanner alerts: price_mover + fear_greed from live CMC data, whale_alert + social_buzz mock-generated — always 200, never fails the banner), `market_depth.py` (thin proxy over MAX order book, powers DepthChart.jsx), `market_trades.py` (thin proxy over MAX recent fills, powers RecentTrades.jsx), `market_fund_flow.py` (資金流向分析: real MAX trades classified into 特大單/大單/中單/小單 by TWD value + buy/sell direction, plus an approximate 7-day net flow derived from daily K-line candles — powers FundFlowChart.jsx), `ai_chat.py` (POST /ai_chat — Bedrock Converse **Tool Use**: the model itself decides whether to call get_fear_greed_index/get_current_price/get_fund_flow_analysis before answering, and separately whether to call propose_trade for a structured trade suggestion — see "AI Chat Tool Use" section below), `allow_trade.py` (POST /allow_trade — real MAX private API order placement via `max_trading.py`'s HMAC-signed client; does NOT yet write the executed trade back to S3, so Portfolio/trade history won't reflect an AI-executed trade until the user re-uploads/re-syncs their CSV — known gap)
- **In progress**: community/chat/questionnaire handlers (`/community/*`, `/tipping`, `/chat/*`, `/questionnaire*` are fully specified in `api.yaml` but have no handler files or `template.yaml` entries yet — pure frontend mock currently)
- **Responsibilities**:
  - S3 read/write (CSV, personality data, community posts, danmaku messages)
  - MAX API proxy (K-line, real-time pricing, orders)
  - CoinMarketCap API (Fear & Greed Index)
  - Trade execution via MAX Skill
  - Community feed & danmaku message handling
  - Questionnaire serving & response processing
  - Recommendation algorithm (personalized feed ordering)

## AI Agent — status: NOT implemented (plain Bedrock Converse instead)

⚠️ Earlier drafts of this document described a `CustomerSupport/` directory
containing an AWS Bedrock AgentCore + Strands Agents SDK agent (with MAX MCP
Server / MAX Skill integration per the original proposal's three-layer
architecture: AI → MCP Server → Skill → REST API). **That directory does
not exist in this repository** — there is no AgentCore config, no Strands
agent, no MCP client, no CDK stack for it anywhere on disk. The actual
implementation is simpler: `backend/src/handlers/ai_chat.py` calls AWS
Bedrock directly via `boto3`'s Converse API (`backend/src/services/bedrock.py`),
and `allow_trade.py` calls MAX's private REST API directly via HMAC-signed
requests (`backend/src/services/max_trading.py`) — no MCP/Skill layer in
between. If MAX MCP Server / MAX Skill integration is required for scoring
purposes, it has not been built and would be new work, not a gap-fill.

### AI Chat Tool Use (`ai_chat.py` + `ai_tools.py`)

`POST /ai_chat` uses Bedrock Converse **Tool Use** — the model decides for
itself, per message, whether it needs live data before answering:

- `get_fear_greed_index` — always offered (no currency needed)
- `get_current_price` / `get_fund_flow_analysis` / `propose_trade` — only
  offered when the request includes a `currency` (see
  `ai_tools.py`'s `build_tool_config()`)

The handler runs a bounded loop (`ai_chat.py`'s `_MAX_TOOL_ROUNDS = 5`):
call Bedrock → if `stopReason == "tool_use"`, execute the requested tool(s)
via `ai_tools.py`'s `execute_tool()` and feed results back → repeat, up to
the round cap, then fall back to a "couldn't complete" message if the
model never produces a final text answer. If the model calls
`propose_trade`, that structured `{action, amount_twd, reason}` becomes
the response's `investment_suggestion` — this is a genuine model decision
informed by whichever tools it chose to call, not a regex/keyword match
against free text (the previous design, which could only ever produce a
hardcoded default amount since the system prompt told the model not to
mention amounts at all).

`amount_twd` (not `amount`) is deliberately spelled out in the
`propose_trade` tool schema with a verbose description — a live smoke
test against `openai.gpt-oss-120b-1:0` showed the model will confuse "an
amount" with "a coin quantity" (e.g. returning `0.0192` instead of a TWD
figure) if the field name/description is ambiguous.

The suggested amount is scaled to the user's own trading habits: 
`ai_chat.py`'s `_load_avg_trade_amount()` reads the user's S3 CSV and calls
`metrics.py`'s `compute_avg_trade_amount()`, passed into the system prompt
as a reference point. Falls back to a conservative NT$1,000–5,000 range
for users with no trade history (see `system_prompt.txt`).

**Model choice**: `openai.gpt-oss-120b-1:0` (the existing default) was
verified via a live Converse API smoke test to correctly support
`toolConfig` — it appropriately skips tool calls for pure knowledge
questions, calls the right tool(s) for data-dependent questions, and
correctly chains multiple tool calls across rounds before producing a
final answer. No model change was needed.

## CDK Infrastructure — not present in this repo

Earlier drafts of this document referenced a `CustomerSupport/agentcore/cdk/`
TypeScript CDK stack. It does not exist on disk (see "AI Agent" section
above) — the only infrastructure-as-code in this repo is `backend/template.yaml`
(AWS SAM), which is what actually deploys the Lambda functions + API Gateway.

## Cloud Services (AWS)

| Service | Purpose |
|---------|---------|
| AWS Lambda | Serverless compute (backend APIs) |
| AWS API Gateway | REST API routing for frontend |
| AWS S3 | CSV storage, personality data, community posts, danmaku messages, questionnaire data |
| AWS Bedrock (Claude) | LLM reasoning — personality analysis, market analysis, conversational trading |
| AWS CDK | Infrastructure as code |
| AWS AgentCore | Agent runtime + deployment |

## External APIs

| API | Purpose | Auth | Status |
|-----|---------|------|--------|
| MAX Exchange API (v3), public endpoints | Real-time pricing, K-line, depth, trades | None | ✅ Implemented (`max_api.py`) |
| MAX Exchange API (v3), private endpoints | Order placement (`allow_trade.py`) | HMAC-signed (`MAX_API_KEY`/`MAX_API_SECRET`) | ✅ Implemented (`max_trading.py`), ⚠️ `template.yaml`'s `AllowTradeFunction` currently deploys with both env vars blank — needs real credentials wired in (e.g. via SAM `Parameters` + `--parameter-overrides`) before this actually works end-to-end |
| MAX MCP Server | MCP-compatible MAX integration | — | ❌ Not implemented — see "AI Agent" section above |
| MAX Skill | Trade execution module | — | ❌ Not implemented — `allow_trade.py` calls the private REST API directly instead |
| CoinMarketCap | Fear & Greed Index, global metrics, listings | API key optional (keyless mode default) | ✅ Implemented (`coinmarketcap.py`) |

## Frontend Key Libraries

| Library | Purpose |
|---------|---------|
| `react-router-dom` | Client-side routing (主頁/幣種趨勢/社群/問券/個人資料) |
| `lightweight-charts` | K-line chart AND the indicator panel's line/histogram chart (v5 API: `addSeries(CandlestickSeries\|LineSeries\|HistogramSeries, opts)`) |
| `fetch` (native) | API communication via `services/api.js` — see "Backend Connection" below |
| Custom `DanmakuOverlay` | CSS-animation barrage overlay on K-line chart (no external library) |
| `utils/indicators.js` | Hand-written technical indicator math (no TA library dependency) |

## Backend Connection

Frontend talks to the backend over plain `fetch`, gated behind one env var:

```bash
cd frontend
cp .env.example .env
# edit .env: VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

- `services/api.js` — the only file that calls `fetch` directly. Reads `import.meta.env.VITE_API_BASE_URL`, throws `ApiError` (10s timeout) if unset or on network/HTTP failure.
- `services/coinApi.js`, `services/aiApi.js`, `services/communityApi.js` — thin wrappers around `apiFetch()`, one function per `operationId` in `backend/api.yaml`.
- **Fallback pattern**: pages check `isBackendConfigured()` before calling the API, and catch/ignore failures so mock data keeps rendering. See `MainPage.jsx`'s `fetchLivePrice()` for the reference implementation — never let a failed API call blank out the UI.
- `.env` / `.env.*` are gitignored (`.env.example` is the only tracked template). Each teammate sets their own `VITE_API_BASE_URL` locally; CI/deploy sets it as a build-time env var.

### What the backend owner (趙文睿) needs to hand off

Once Lambda + API Gateway are deployed, the frontend only needs **one URL**:

1. **API Gateway Invoke URL** — the base URL, e.g. `https://abc123xyz.execute-api.ap-northeast-1.amazonaws.com/prod`. This alone is enough to fill in `VITE_API_BASE_URL`.
2. Confirm **CORS** is enabled on the API Gateway (allow the frontend's origin, or `*` for hackathon purposes) — browsers block cross-origin `fetch` without it, and this is the most common integration blocker.
3. Confirm the **stage name** included in the URL (e.g. `/prod`, `/dev`) matches what's deployed — mismatches produce silent 403/404s.
4. If any endpoint requires auth (API key, Cognito, IAM), that needs to be communicated separately — none of the current `services/*.js` wrappers send auth headers yet.

### CORS gotcha: every Lambda response needs its own CORS headers

API Gateway's "Enable CORS" console action / OPTIONS mock integration only adds `Access-Control-Allow-*` headers to the **OPTIONS preflight** response. It does **not** add them to the actual GET/POST response coming back from the Lambda function — that response is passed straight through unmodified. A request can return `200 OK` with the correct JSON body and still get blocked by the browser as a CORS error, because the browser checks the headers on the *real* response, not just the preflight.

**Every Lambda handler must add CORS headers to every response it returns — success and error alike.** Use `backend/src/utils/http.py`'s `json_response(status_code, body)` instead of hand-building `{"statusCode": ..., "headers": {...}, "body": ...}` dicts — it merges in `Access-Control-Allow-Origin: *` (overridable via the `ALLOWED_ORIGIN` env var) automatically. All current handlers (`coin_price.py`, `fear_greed.py`, `upload_csv.py`, `market_overview.py`, `candlestick_chart.py`, `notifications.py`, `init.py`, `get_personality.py`, `save_personality.py`, `portfolio.py`, `trade_history.py`, `market_depth.py`, `market_trades.py`, `market_fund_flow.py`) already use it; any new handler should too.

### CoinMarketCap keyless endpoint quirk: `quote` is a list, not a dict

The authenticated CMC Pro API returns `quote: {"USD": {...}}`. The **keyless public endpoint** (`/public-api/...`, no `CMC_API_KEY` set) returns `quote: [{"symbol": "USD", ...}]` for `listings/latest` — a list you must search by `symbol == "USD"`, not a dict you can index directly. See `market_overview.py`'s `_extract_usd_quote_field()`. Also: never rank the full CMC universe directly by `percent_change_24h` for a "top movers" feature — that surfaces near-zero-market-cap tokens with meaningless four-digit swings. Pull a market-cap-ranked pool first (`_RANKING_POOL_SIZE`), then sort within it.

### MAX `/trades` pagination: `timestamp` param is MILLISECONDS and excludes the boundary trade

`max_api.py`'s `get_trades(market, limit, timestamp_ms)` wraps MAX's v3 `/api/v3/trades` endpoint. To page backward in time, pass the oldest trade's `created_at` (already in milliseconds) as `timestamp_ms` on the next call — MAX returns only trades *strictly older* than that timestamp (the boundary trade is not repeated). Passing seconds instead of milliseconds returns a `1001 timestamp does not have a valid value` error. `market_fund_flow.py`'s `_fetch_trades_within_window()` is the reference implementation of this pagination loop (capped at 5 pages / 5000 trades per request to bound Lambda execution time).

### Fund-flow size thresholds (特大單/大單/中單/小單) are a documented convention, not an industry standard

There is no universal definition of "large order" vs "small order" in crypto trading — every data vendor picks its own cutoffs. `backend/src/utils/constants.py`'s `FUND_FLOW_EXTRA_LARGE_THRESHOLD_TWD` / `FUND_FLOW_LARGE_THRESHOLD_TWD` / `FUND_FLOW_MEDIUM_THRESHOLD_TWD` classify by **TWD trade value** (not coin quantity or % of daily volume) specifically so a threshold means the same "amount of money" across all 6 supported coins. If asked in a demo/judging context, the honest answer is: real trade data from MAX, self-disclosed classification thresholds (documented in the constants file), no fabricated numbers.

### New handlers need a `template.yaml` entry too

Adding a handler file under `backend/src/handlers/` is not enough to deploy it — it must also be registered as an `AWS::Serverless::Function` (with its API Gateway route) in `backend/template.yaml`, matching the `Handler: src.handlers.<module>.lambda_handler` convention already used by the other functions.

## Data Models (S3 Storage)

| Data | S3 Key Pattern | Format |
|------|---------------|--------|
| User CSV | `users/{userId}/trades.csv` | CSV |
| Personality Profile (scores + AI description) | `users/{userId}/trade_metrics.json` | JSON — written by `upload_csv.py`/`save_personality.py`, read by `get_personality.py` via `s3_storage.py`'s `get_trade_metrics()` |
| Community Posts | `community/posts/{postId}.json` | JSON |
| Danmaku Messages | `danmaku/{symbol}/{timestamp}.json` | JSON |
| Questionnaire Responses | `users/{userId}/questionnaire/{id}.json` | JSON |
| Chat History | `users/{userId}/chat_history.json` | JSON |
| Watchlist | `users/{userId}/watchlist.json` | JSON |
| User Points (積分) | `users/{userId}/points.json` | JSON |
| Sentiment Cache | `sentiment/{symbol}/latest.json` | JSON |
| Bounty Questions | `community/bounties/{bountyId}.json` | JSON |
| Copy Trade Log | `users/{userId}/copy_trades.json` | JSON |

## Common Commands

### Backend (SAM)

```bash
cd backend
sam build
sam deploy              # subsequent deploys; samconfig.toml has stack config
sam deploy --guided     # first deploy, or to change stack parameters
python -m pytest tests/ -q
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # Vite dev server
npm run build          # Production build
```

## Key Reference Docs

- MAX API: https://max-api.maicoin.com/doc/v3.html
- MAX MCP Server (not integrated, see "AI Agent" section): https://github.com/bistin/max-mcp-server
- MAX Skill (not integrated, see "AI Agent" section): https://github.com/bistin/max-api-skill
- CoinMarketCap API: https://pro.coinmarketcap.com/api/documentation/
- Bedrock Converse API Tool Use: https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html
- lightweight-charts: https://tradingview.github.io/lightweight-charts/
