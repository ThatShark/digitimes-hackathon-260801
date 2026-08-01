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
- **Implemented handlers**: `upload_csv.py` (CSV → metrics → S3), `coin_price.py` (MAX ticker), `fear_greed.py` (CoinMarketCap latest/historical), `market_overview.py` (行情看板: Fear&Greed + dominance + market cap/volume + gainers/losers), `candlestick_chart.py` (MAX K-line + S3 CSV buy/sell markers merged), `notifications.py` (dynamic NotificationBanner alerts: price_mover + fear_greed from live CMC data, whale_alert + social_buzz mock-generated — always 200, never fails the banner)
- **In progress**: `ai_chat.py`, `allow_trade.py`, community/chat/questionnaire handlers
- **Responsibilities**:
  - S3 read/write (CSV, personality data, community posts, danmaku messages)
  - MAX API proxy (K-line, real-time pricing, orders)
  - CoinMarketCap API (Fear & Greed Index)
  - Trade execution via MAX Skill
  - Community feed & danmaku message handling
  - Questionnaire serving & response processing
  - Recommendation algorithm (personalized feed ordering)

## AI Agent (AgentCore)

- **Framework**: AWS Bedrock AgentCore + Strands Agents SDK
- **Language**: Python 3.14 (CodeZip build)
- **Location**: `CustomerSupport/app/CustomerSupport/`
- **Package manager**: uv (uses `pyproject.toml` + `uv.lock`)
- **Key dependencies**:
  - `strands-agents >= 1.15.0`
  - `bedrock-agentcore >= 1.9.1`
  - `mcp >= 1.19.0`
  - `aws-opentelemetry-distro`
  - `botocore[crt] >= 1.35.0`
- **MCP Client**: Streamable HTTP (currently connected to Exa AI for web search)
- **AI Behavior**:
  - Passive by default — responds only when user initiates consultation
  - Provides personalized advice based on personality profile + trading history
  - Fallback: references crowd behavior / same-personality-type users when data insufficient
  - Personality analysis: MBTI-style 4-dimension system from CSV metrics + questionnaire signals

## CDK Infrastructure

- **Location**: `CustomerSupport/agentcore/cdk/`
- **Language**: TypeScript
- **CDK version**: 2.1126.0
- **Key constructs**: `@aws/agentcore-cdk`
- **Package manager**: npm

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

| API | Purpose | Auth |
|-----|---------|------|
| MAX Exchange API (v3) | Real-time pricing, K-line, depth, orders | API Key (Private API for Lv2) |
| MAX MCP Server | MCP-compatible MAX integration | — |
| MAX Skill | Trade execution module | — |
| CoinMarketCap | Fear & Greed Index | API Key |

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

**Every Lambda handler must add CORS headers to every response it returns — success and error alike.** Use `backend/src/utils/http.py`'s `json_response(status_code, body)` instead of hand-building `{"statusCode": ..., "headers": {...}, "body": ...}` dicts — it merges in `Access-Control-Allow-Origin: *` (overridable via the `ALLOWED_ORIGIN` env var) automatically. All current handlers (`coin_price.py`, `fear_greed.py`, `upload_csv.py`, `market_overview.py`, `candlestick_chart.py`, `notifications.py`) already use it; any new handler should too.

### CoinMarketCap keyless endpoint quirk: `quote` is a list, not a dict

The authenticated CMC Pro API returns `quote: {"USD": {...}}`. The **keyless public endpoint** (`/public-api/...`, no `CMC_API_KEY` set) returns `quote: [{"symbol": "USD", ...}]` for `listings/latest` — a list you must search by `symbol == "USD"`, not a dict you can index directly. See `market_overview.py`'s `_extract_usd_quote_field()`. Also: never rank the full CMC universe directly by `percent_change_24h` for a "top movers" feature — that surfaces near-zero-market-cap tokens with meaningless four-digit swings. Pull a market-cap-ranked pool first (`_RANKING_POOL_SIZE`), then sort within it.

### New handlers need a `template.yaml` entry too

Adding a handler file under `backend/src/handlers/` is not enough to deploy it — it must also be registered as an `AWS::Serverless::Function` (with its API Gateway route) in `backend/template.yaml`, matching the `Handler: src.handlers.<module>.lambda_handler` convention already used by the other functions.

## Data Models (S3 Storage)

| Data | S3 Key Pattern | Format |
|------|---------------|--------|
| User CSV | `users/{userId}/trades.csv` | CSV |
| Personality Profile | `users/{userId}/personality.json` | JSON |
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

### AgentCore Agent (Python)

```bash
# Run agent locally with hot-reload
agentcore dev

# Deploy to AWS
agentcore deploy

# Validate configuration
agentcore validate

# Invoke agent (local or deployed)
agentcore invoke

# View logs / traces
agentcore logs
agentcore traces list
```

### CDK Infrastructure

```bash
cd CustomerSupport/agentcore/cdk
npm install
npm run build          # TypeScript compile
npm test               # Jest tests
npx cdk synth          # Synthesize CloudFormation
npx cdk deploy         # Deploy stack
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # Vite dev server
npm run build          # Production build
```

### Python Agent Dependencies

```bash
cd CustomerSupport/app/CustomerSupport
uv sync                # Install dependencies from uv.lock
uv add <package>       # Add new dependency
```

## Key Reference Docs

- MAX API: https://max-api.maicoin.com/doc/v3.html
- MAX MCP Server: https://github.com/bistin/max-mcp-server
- MAX Skill: https://github.com/bistin/max-api-skill
- CoinMarketCap API: https://pro.coinmarketcap.com/api/documentation/
- AgentCore CLI: https://github.com/aws/agentcore-cli
- AgentCore CDK: https://github.com/aws/agentcore-l3-cdk-constructs
- lightweight-charts: https://tradingview.github.io/lightweight-charts/
