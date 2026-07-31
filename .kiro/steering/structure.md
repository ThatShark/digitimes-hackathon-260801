# Project Structure

```
digitimes-hackathon-260801/
├── README.md                    # Project overview (Chinese)
├── Proposal.md                  # Internal design doc — full feature specs, API docs, team roles
├── package.json                 # Root-level (minimal)
│
├── frontend/                    # React + Vite frontend
│   └── src/
│       ├── App.jsx              # Root component, routing
│       ├── main.jsx             # Entry point
│       ├── pages/
│       │   ├── MainPage.jsx         # YouTube-style homepage (平時關注/熱門/潛力/社群貼文)
│       │   ├── CoinTrendPage.jsx    # Live stream page (K-line + AI chat + danmaku)
│       │   ├── CommunityPage.jsx    # Threads-style social feed
│       │   ├── ProfilePage.jsx      # User profile (personality, stats, history)
│       │   └── QuestionnairePage.jsx # Personality questionnaire flow
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx          # Side navigation
│       │   │   └── SearchBar.jsx        # Top search bar
│       │   ├── main/
│       │   │   ├── CoinCard.jsx         # Coin thumbnail card (used in 平時關注/熱門/潛力)
│       │   │   ├── HotPostCard.jsx      # Community post preview card
│       │   │   ├── MarketOverview.jsx   # 行情看板 (漲跌幅榜/成交量榜/恐懼貪婪指數)
│       │   │   └── Watchlist.jsx        # 自選幣種清單 (add/remove coins)
│       │   ├── trend/
│       │   │   ├── KLineChart.jsx       # K-line chart (lightweight-charts)
│       │   │   ├── ProgressBar.jsx      # Draggable time progress bar
│       │   │   ├── ChartSettings.jsx    # Danmaku toggle, size, time scale (日/月/年)
│       │   │   ├── IndicatorPanel.jsx   # Technical indicators (default off)
│       │   │   ├── TradePanel.jsx       # Order execution panel (市價/限價/止盈止損)
│       │   │   ├── DepthChart.jsx       # Order book depth chart (MAX API)
│       │   │   ├── RecentTrades.jsx     # Real-time trade stream (MAX API)
│       │   │   ├── AIChatPanel.jsx      # AI conversation tab
│       │   │   └── DanmakuPanel.jsx     # Barrage/chat room tab (Bilibili-style)
│       │   ├── community/
│       │   │   ├── PostCard.jsx         # Single post with personality prefix + verified badge
│       │   │   ├── PostComposer.jsx     # Create new post (supports $Ticker auto-detection)
│       │   │   ├── QuestionnaireCard.jsx # Questionnaire "ad card" in feed
│       │   │   ├── VerifiedBadge.jsx    # 實盤驗證標籤 (Verified PnL indicator)
│       │   │   ├── CopyTradeButton.jsx  # 「跟隨此策略」按鈕 + 金額設定 modal
│       │   │   ├── TickerCard.jsx       # $BTC/$ETH 動態幣種互動卡片
│       │   │   ├── WhaleAlertCard.jsx   # 巨鯨警報卡片 (mock data + 一鍵追買)
│       │   │   ├── SentimentGauge.jsx   # 社群情緒儀表盤 (看多/看空比例)
│       │   │   ├── TipButton.jsx        # 微額打賞按鈕 (虛擬積分)
│       │   │   └── BountyQuestion.jsx   # 付費懸賞提問卡片
│       │   ├── profile/
│       │   │   ├── PortfolioOverview.jsx # 資產總覽 (holdings × price, P&L, pie chart)
│       │   │   ├── TradeHistory.jsx     # 交易歷史明細 (filterable table)
│       │   │   └── PersonalityChart.jsx # 4-axis personality radar/bar chart
│       │   └── shared/
│       │       ├── PersonalityBadge.jsx  # Personality type prefix/title display
│       │       ├── DanmakuOverlay.jsx    # Danmaku overlay on K-line chart
│       │       └── NotificationBanner.jsx # 系統通知 (市場異動/AI提醒)
│       ├── hooks/                # Custom React hooks
│       │   ├── useKLineData.js
│       │   ├── useDanmaku.js
│       │   ├── useCommunityFeed.js
│       │   ├── useWatchlist.js      # Watchlist CRUD operations
│       │   ├── usePortfolio.js      # Portfolio value calculation
│       │   ├── useMarketData.js     # Market overview data (gainers/losers/volume)
│       │   ├── useTickerData.js     # $Ticker card real-time price data
│       │   └── useSentiment.js      # Community sentiment polling
│       ├── services/             # API call wrappers
│       │   ├── api.js            # Base axios/fetch config
│       │   ├── chartApi.js       # /candlestick_chart
│       │   ├── aiApi.js          # /ai_chat
│       │   ├── tradeApi.js       # /allow_trade (market/limit/TP-SL)
│       │   ├── communityApi.js   # /community, /danmaku, /sentiment, /tipping, /bounty
│       │   ├── questionnaireApi.js # /questionnaire
│       │   ├── marketApi.js      # /market/overview, /market/depth, /market/trades
│       │   ├── watchlistApi.js   # /watchlist (GET/POST)
│       │   ├── portfolioApi.js   # /portfolio, /trade_history
│       │   ├── copyTradeApi.js   # /copy_trade (POST)
│       │   └── whaleAlertApi.js  # /whale_alerts (GET)
│       └── styles/               # CSS / style files
│
├── backend/                     # AWS Lambda backend
│   └── src/
│       ├── handlers/
│       │   ├── init.py              # GET /init
│       │   ├── upload_csv.py        # POST /upload_csv
│       │   ├── candlestick_chart.py # GET /candlestick_chart
│       │   ├── ai_chat.py          # POST /ai_chat
│       │   ├── allow_trade.py      # POST /allow_trade (market/limit/TP-SL)
│       │   ├── community.py        # GET/POST /community
│       │   ├── danmaku.py          # GET/POST /danmaku
│       │   ├── questionnaire.py    # GET/POST /questionnaire
│       │   ├── market.py           # GET /market/overview, /market/depth, /market/trades
│       │   ├── watchlist.py        # GET/POST /watchlist
│       │   ├── portfolio.py        # GET /portfolio
│       │   ├── trade_history.py    # GET /trade_history
│       │   ├── copy_trade.py       # POST /copy_trade (跟單執行)
│       │   ├── sentiment.py        # GET /sentiment/:symbol (社群情緒分析)
│       │   ├── whale_alert.py      # GET /whale_alerts (巨鯨警報 mock)
│       │   ├── tipping.py          # POST /tipping (虛擬積分打賞)
│       │   └── bounty.py           # GET/POST /bounty (懸賞提問)
│       ├── services/
│       │   ├── max_api.py           # MAX Exchange API client (K-line, depth, trades, orders)
│       │   ├── coinmarketcap.py     # CoinMarketCap API client (Fear&Greed, dominance)
│       │   ├── s3_storage.py        # S3 read/write utilities
│       │   ├── personality.py       # Personality calculation logic + verified PnL
│       │   ├── recommendation.py    # Feed recommendation algorithm
│       │   ├── sentiment.py         # AI sentiment analysis (NLP on community posts)
│       │   └── points.py            # Virtual points system (tips + bounty accounting)
│       └── utils/
│           └── metrics.py           # CSV indicator computation
│
├── CustomerSupport/             # AgentCore AI agent project
│   ├── AGENTS.md                # AI assistant context for AgentCore schema
│   ├── README.md                # AgentCore project docs + CLI commands
│   │
│   ├── agentcore/               # Declarative config (source of truth)
│   │   ├── agentcore.json       # Project config — agents, resources, gateways
│   │   ├── aws-targets.json     # Deployment targets (account + region)
│   │   ├── .env.local           # Secrets (gitignored)
│   │   ├── .llm-context/        # TypeScript type defs for schema validation
│   │   └── cdk/                 # CDK infrastructure (TypeScript)
│   │       ├── lib/cdk-stack.ts
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   └── app/                     # Agent application code
│       └── CustomerSupport/     # Python agent (Strands SDK)
│           ├── main.py          # Entrypoint — agent factory, invoke handler
│           ├── pyproject.toml   # Python deps (hatchling build)
│           ├── uv.lock          # Lockfile
│           ├── model/           # Model loading & Bedrock compatibility
│           ├── mcp_client/      # MCP client config (Streamable HTTP)
│           └── skills/          # Skill fetcher (S3/git download + cache)
│
└── .kiro/                       # Kiro IDE configuration
    └── steering/                # Steering rules
        ├── product.md           # Product summary & features
        ├── tech.md              # Tech stack & commands
        ├── structure.md         # This file
        ├── proposal.md          # Full internal proposal (企劃書)
        ├── hackthon_rule.md     # Competition rules & scoring
        └── platform-features.md # 完整交易平台功能對照表 (適用性篩選)
```

## Frontend Pages & Components

### Pages

| Page | Route | Description |
|------|-------|-------------|
| MainPage | `/` | YouTube-style homepage with coin cards in sections (平時關注, 熱門, 潛力, 社群貼文) + Market Overview |
| CoinTrendPage | `/coin/:symbol` | Live stream page — K-line chart + AI chat + danmaku + trade panel + depth/trades |
| CommunityPage | `/community` | Threads-style social feed with personality-weighted algorithm |
| ProfilePage | `/profile` | User profile — personality 4-axis, portfolio overview, trade history, watched coins |
| QuestionnairePage | `/questionnaire` | Personality questionnaire (also appears as cards in community feed) |

### Layout

- **Sidebar**: Persistent side navigation (主頁, 社群, 設定, etc.)
- **SearchBar**: Top search bar for coins and users

### CoinTrendPage Layout

```
┌──────────────────────────────┬────────────────────┐
│                              │ [AI對話] [彈幕留言]  │
│   K-Line Chart               │   Chat Panel       │
│   + Danmaku Overlay          │   (tab switch)     │
│   + Progress Bar             │                    │
│   + Settings (彈幕/時距)      │                    │
├──────────────────────────────┼────────────────────┤
│ [深度圖] [最新成交]           │   Trade Panel      │
│  (collapsible tabs)          │ (市價/限價/止盈止損) │
├──────────────────────────────┤                    │
│   Indicator Panel            │                    │
│   (default: off)             │                    │
└──────────────────────────────┴────────────────────┘
```

## Danmaku (Barrage) System

Implementation: **Pure CSS animation** (方案 A)

- `DanmakuOverlay` component is positioned `absolute` over the K-line chart container
- Each bullet is a `<span>` with `@keyframes danmaku-scroll` (right → left)
- 6 tracks to avoid overlap; bullets get assigned to the least recently used track
- Animation duration scales with text length (longer = slightly slower)
- Bullets are removed from DOM via `onAnimationEnd` callback
- Toggle on/off via `danmakuEnabled` state in CoinTrendPage
- User can send danmaku from the chart controls bar (✉ button → inline input)
- Mock simulator sends random messages every 2-4 seconds for demo purposes
- `pointer-events: none` on the overlay so the chart remains interactive beneath
- Configurable settings via popover: speed (慢/中/快), size (小/中/大), position (上方/全部/下方)
- Default position is `top` (upper 30% of chart) to avoid blocking the candlestick data

### Key Files

| File | Role |
|------|------|
| `components/shared/DanmakuOverlay.jsx` | Overlay container + bullet rendering + mock simulator |
| `components/shared/DanmakuOverlay.css` | `@keyframes danmaku-scroll`, positioning, text-shadow |
| `components/trend/ChartControls.jsx` | Toggle button + send input inline |
| `pages/CoinTrendPage.jsx` | State management, wires overlay + controls together |

## Key Conventions

- **Config is source of truth**: `agentcore/agentcore.json` defines agents, memories, credentials, gateways. Never edit generated CDK code directly.
- **Flat resource model**: All AgentCore resources are independent top-level arrays. No nesting.
- **Naming = Identity**: Resource `name` fields map to CloudFormation Logical IDs. Renaming destroys + recreates.
- **Secrets**: API keys go in `agentcore/.env.local` (gitignored). Never commit secrets.
- **API contract**: Frontend/backend communicate via REST endpoints. Core endpoints:
  - `GET /init` — check CSV status
  - `POST /upload_csv` — upload + trigger analysis
  - `GET /candlestick_chart` — K-line + trade markers
  - `POST /ai_chat` — AI conversation
  - `POST /allow_trade` — confirm trade execution (market/limit/TP-SL)
  - `GET /market/overview` — gainers, losers, volume ranking, Fear & Greed
  - `GET /market/depth` — order book depth for a coin
  - `GET /market/trades` — recent trades for a coin
  - `GET/POST /watchlist` — user's watchlist CRUD
  - `GET /portfolio` — holdings, P&L, allocation
  - `GET /trade_history` — filtered trade history
  - `GET/POST /community` — social feed
  - `GET/POST /danmaku` — barrage messages
  - `GET/POST /questionnaire` — personality questionnaire
  - `POST /copy_trade` — execute copy trade (follow strategy)
  - `GET /sentiment/:symbol` — community sentiment gauge
  - `GET /whale_alerts` — whale alert events (mock)
  - `POST /tipping` — virtual tip (積分打賞)
  - `GET/POST /bounty` — bounty Q&A (懸賞提問)

## Languages by Directory

| Directory | Language | Package Manager |
|-----------|----------|-----------------|
| `frontend/` | JavaScript (React + Vite) | npm |
| `backend/` | Python (Lambda) | pip / uv |
| `CustomerSupport/app/` | Python 3.14 | uv |
| `CustomerSupport/agentcore/cdk/` | TypeScript | npm |

## Team Roles (for context)

| Member | Responsibility |
|--------|---------------|
| 林睿瑜 (Lead) | Frontend AI chat, API design, presentation |
| 林志恩 | Frontend: live stream page (K-line + danmaku + chat) |
| 郭凱明 | Frontend: main page (coin cards + community) |
| 趙文睿 | Backend A: AWS infra, API Gateway, MAX/CMC API |
| 薛宇宏 | Backend B: AI core, Bedrock, personality analysis |
