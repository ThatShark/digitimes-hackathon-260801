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
- **Implemented handlers**: `upload_csv.py` (CSV → metrics → S3), `coin_price.py` (MAX ticker), `fear_greed.py` (CoinMarketCap latest/historical)
- **In progress**: `candlestick_chart.py`, `ai_chat.py`, `allow_trade.py`, community/chat/questionnaire handlers
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
| `axios` or `fetch` | API communication (not yet wired — pages currently use mock data) |
| Custom `DanmakuOverlay` | CSS-animation barrage overlay on K-line chart (no external library) |
| `utils/indicators.js` | Hand-written technical indicator math (no TA library dependency) |

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
