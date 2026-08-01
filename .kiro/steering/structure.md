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
│       │   ├── CoinTrendPage.jsx    # Live stream page (K-line + AI chat + danmaku) — owns chat/danmaku state
│       │   ├── CommunityPage.jsx    # Threads-style social feed
│       │   ├── ProfilePage.jsx      # User profile (personality, stats, history)
│       │   └── QuestionnairePage.jsx # Personality questionnaire flow
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Layout.jsx           # App shell — sidebar + header + outlet
│       │   │   ├── Sidebar.jsx          # Side navigation (☰ toggle, collapsible)
│       │   │   └── SearchBar.jsx        # Top search bar
│       │   ├── main/
│       │   │   ├── MarketOverview.jsx   # 行情看板 (漲跌幅榜/成交量榜/恐懼貪婪指數)
│       │   │   └── Watchlist.jsx        # 自選幣種清單 (add/remove coins)
│       │   ├── trend/
│       │   │   ├── KLineChart.jsx       # K-line chart (lightweight-charts)
│       │   │   ├── ProgressBar.jsx      # Draggable time progress bar
│       │   │   ├── ChartSettings.jsx    # Danmaku toggle, size, time scale (日/月/年)
│       │   │   ├── IndicatorPanel.jsx   # Technical indicators (default off)
│       │   │   ├── TradePanel.jsx       # Order execution panel (市價/限價/止盈止損)
│       │   │   ├── DepthChart.jsx       # Order book depth (SVG cumulative area chart)
│       │   │   ├── RecentTrades.jsx     # Real-time trade stream (MAX API)
│       │   │   ├── AIChatPanel.jsx      # AI conversation + 彈幕聊天 (dual tab)
│       │   │   ├── DanmakuPanel.jsx     # Barrage/chat room tab (Bilibili-style)
│       │   │   ├── CoinOverview.jsx     # 概況 tab (市值/流通量/ATH/ATL/簡介)
│       │   │   ├── FundFlowChart.jsx    # 數據 tab (資金流向圓餅圖 + 淨流向柱狀圖)
│       │   │   ├── StrategyHub.jsx      # 策略 tab (建立入口 + AI模板 + 實盤動態)
│       │   │   ├── KeyEvents.jsx        # 關鍵事件面板 (鏈上大額轉帳 log)
│       │   │   └── ShareButton.jsx      # 分享按鈕 (複製連結/長圖/社交分享)
│       │   ├── community/
│       │   │   ├── PostCard.jsx         # Single post with personality prefix + verified badge; clicking navigates to /community/post/:postId (action buttons stopPropagation)
│       │   │   ├── PostComposer.jsx     # Create new post (supports $Ticker auto-detection)
│       │   │   ├── CommentItem.jsx      # Single floor-numbered comment (flat, no nested replies); has its own like + TipButton
│       │   │   ├── CommentComposer.jsx  # Reply input at bottom of post detail page — text + up to 4 images (mock via blob URL)
│       │   │   ├── ShareButton.jsx      # Popover with the post's shareable URL (window.location.origin + /community/post/:id) + copy-to-clipboard
│       │   │   ├── QuestionnaireCard.jsx # Questionnaire "ad card" in feed
│       │   │   ├── VerifiedBadge.jsx    # 實盤驗證標籤 (Verified PnL indicator)
│       │   │   ├── CopyTradeButton.jsx  # 「跟隨此策略」按鈕 + 金額設定 modal
│       │   │   ├── TickerCard.jsx       # $BTC/$ETH 動態幣種互動卡片
│       │   │   ├── WhaleAlertCard.jsx   # 巨鯨警報卡片 (mock data + 一鍵追買)
│       │   │   ├── SentimentGauge.jsx   # 社群情緒儀表盤 (看多/看空比例)
│       │   │   ├── TipButton.jsx        # 微額打賞按鈕 (虛擬積分) — used on both posts and comments independently
│       │   │   └── BountyQuestion.jsx   # 付費懸賞提問卡片
│       │   ├── profile/
│       │   │   └── PortfolioOverview.jsx # 資產總覽 (holdings × price, P&L)
│       │   └── shared/
│       │       ├── PersonalityBadge.jsx  # Personality type prefix/title display
│       │       ├── DanmakuOverlay.jsx    # Danmaku overlay on K-line chart — pure rendering, no own mock data (fed via `messages` prop from CoinTrendPage)
│       │       └── NotificationBanner.jsx # 系統通知 (市場異動/AI提醒)
│       ├── utils/
│       │   ├── indicators.js     # Technical indicator math: MA/EMA/MACD/BOLL/RSI/KDJ/STOCH/VOL/OBV/ATR (pure functions, candles in → {time,value}[] out)
│       │   ├── mockChat.js       # Shared mock chat/danmaku data (users, message pool) — single source so chat panel and danmaku overlay stay in sync
│       │   └── mockCommunity.js  # Shared mock posts/comments/bounties — single source so CommunityPage (feed) and PostDetailPage (thread) never diverge
│       ├── services/             # API client layer — see tech.md "Backend Connection"
│       │   ├── api.js            # Base fetch wrapper (apiFetch/ApiError/isBackendConfigured), reads VITE_API_BASE_URL
│       │   ├── coinApi.js        # /coin/price, /market/fear-greed, /candlestick_chart
│       │   ├── aiApi.js          # /ai_chat, /allow_trade
│       │   └── communityApi.js   # /community/feed, /community/post, likes, comments, /tipping
│       └── __tests__/
│           └── preservation.test.jsx
│
├── backend/                     # AWS Lambda backend
│   ├── api.yaml                 # OpenAPI 3.0.3 spec — source of truth for all endpoints
│   ├── pytest.ini
│   ├── requirements.txt / requirements-dev.txt
│   ├── template.yaml             # SAM template — Lambda functions + API Gateway routes + S3 bucket
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── upload_csv.py         # POST /upload_csv — S3 read CSV → compute_metrics_json → S3 write → response
│   │   │   ├── coin_price.py         # GET /coin/price — MAX ticker lookup for one currency
│   │   │   ├── fear_greed.py         # GET /market/fear-greed — CoinMarketCap latest/historical index
│   │   │   ├── market_overview.py    # GET /market/overview — Fear&Greed + BTC dominance + market cap/volume + gainers/losers (each field best-effort, only 502s if ALL CMC sources fail)
│   │   │   └── candlestick_chart.py  # GET /candlestick_chart — MAX K-line + user's S3 CSV buy/sell markers merged (trade_markers is best-effort, never fails the chart)
│   │   ├── services/
│   │   │   ├── max_api.py           # MAX Exchange API client (ticker, tickers, klines, markets)
│   │   │   ├── coinmarketcap.py     # CoinMarketCap keyless public API client (fear&greed, global-metrics, listings) — no API key needed unless CMC_API_KEY env var is set
│   │   │   └── s3_storage.py        # S3 read/write with retry (3 attempts, 2s delay)
│   │   └── utils/
│   │       ├── metrics.py           # CSV → FIFO trade matching → trading metrics (chase_up_index/avg_return_pct/etc), no I/O
│   │       └── http.py              # json_response()/cors_headers() — every handler must use this, see tech.md "CORS gotcha"
│   └── tests/
│       ├── handlers/
│       │   ├── test_candlestick_chart.py  # Mocked MAX API + S3; validation, range filtering, malformed rows, marker merge
│       │   └── test_market_overview.py    # Mocked CMC calls; per-field partial-failure degradation, quote-list parsing quirk
│       └── utils/
│           ├── test_metrics_unit.py
│           └── test_metrics_property_calculate.py  # Hypothesis property-based tests, independently re-derive each formula
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
| CoinTrendPage | `/coin/:symbol` | 6 分頁制：行情(K線+彈幕+交易) / 概況(基本面) / 數據(資金流向) / 動態(AI+社群) / 交易(下單+深度) / 策略(機器人) |
| CommunityPage | `/community` | Threads-style social feed with personality-weighted algorithm |
| PostDetailPage | `/community/post/:postId` | Single post + floor-numbered comment thread (no nested replies) |
| ProfilePage | `/profile` | User profile — personality 4-axis, portfolio overview, trade history, watched coins |
| QuestionnairePage | `/questionnaire` | Personality questionnaire (also appears as cards in community feed) |

### Layout

- **Sidebar**: Persistent side navigation (主頁, 社群, 問卷). Toggle button is a ☰ hamburger icon (not an arrow — avoid looking like a "back" button).
- **SearchBar**: Top search bar for coins and users
- **Avatar button** (top-right, in `Layout.jsx` header): navigates to `/profile` on click. This is the only entry point to the profile page — it is intentionally not in the sidebar.

### CoinTrendPage Layout

```
┌──────────────────────────────┬────────────────────┐
│                              │ [AI對話] [彈幕聊天]  │
│   K-Line Chart               │   Chat Panel       │
│   + Danmaku Overlay          │   (tab switch)     │
│   + Progress Bar             │                    │
│   + Settings (彈幕/時距)      │                    │
├──────────────────────────────┼────────────────────┤
│ [深度圖] [最新成交]           │   Trade Panel      │
│  (collapsible tabs)          │ (市價/限價/止盈止損) │
├──────────────────────────────┤                    │
│   Indicator Panel            │                    │
│   (real line-chart values)   │                    │
└──────────────────────────────┴────────────────────┘
```

`CoinTrendPage` owns all shared state and is the single source of truth for:
- Progress bar visible range (fractions + actual timestamps) — pushed down to both `KLineChart` and `IndicatorPanel` so both charts show the exact same time window
- Community chat + danmaku messages — a single `addCommunityMessage()` call writes to both `communityMessages` (rendered by `AIChatPanel`) and `danmakuMessages` (rendered by `DanmakuOverlay`), so the two views never diverge
- Danmaku settings (speed/size/position) and enabled state

## Danmaku (Barrage) System

Implementation: **Pure CSS animation** (方案 A)

- `DanmakuOverlay` component is positioned `absolute` over the K-line chart container
- Each bullet is a `<span>` with `@keyframes danmaku-scroll` (right → left)
- 6 tracks to avoid overlap; bullets are assigned to a clear track (with clearance-time estimation) or dropped/force-assigned depending on whether the message is a mock or user message
- Animation duration scales with text length (longer = slightly slower)
- Bullets are removed from DOM via `onAnimationEnd` callback
- Toggle on/off via `danmakuEnabled` state in CoinTrendPage
- User can send danmaku from the chart controls bar (✉ button → inline input) — routes through `CoinTrendPage.addCommunityMessage`
- **No internal mock generator** — `DanmakuOverlay` is purely a renderer driven by the `messages` prop. All message generation (including the periodic mock simulator) lives in `CoinTrendPage` / `utils/mockChat.js`, so the chat panel and danmaku overlay always show identical content.
- `pointer-events: none` on the overlay so the chart remains interactive beneath
- Configurable settings via popover: speed (慢/中/快), size (小/中/大), position (上20% / 上40% / 全部)
- Default position is `top20` (upper 20% of chart) to avoid blocking the candlestick data

### Key Files

| File | Role |
|------|------|
| `components/shared/DanmakuOverlay.jsx` | Overlay container + bullet rendering only (no mock data of its own) |
| `components/shared/DanmakuOverlay.css` | `@keyframes danmaku-scroll`, positioning, text-shadow |
| `components/trend/ChartControls.jsx` | Toggle button, settings popover, send input inline |
| `utils/mockChat.js` | Shared mock user/message pool used by the periodic simulator |
| `pages/CoinTrendPage.jsx` | Single source of truth: generates mock messages, feeds both chat panel and danmaku overlay |

## Auto-Scroll Convention (Chat Panels)

Chat-like scrolling containers (AI chat, community chat) must **never** use `scrollIntoView()` — it scrolls all scrollable ancestors, including the page itself, causing the whole page to jump. Instead:
- Track "is user at bottom" via an `onScroll` handler on the container, stored in a ref *before* new content is appended (checking after appending gives a false negative once content overflows).
- On new message: if the ref says "was at bottom", set `container.scrollTop = container.scrollHeight` (scopes the scroll to that container only).
- If the user has scrolled up and a new message arrives, show a floating "跳到最新訊息" button (Discord-style) instead of forcing a scroll; clicking it does a smooth `scrollTo` and clears the flag.
- Page-level containers that should never scroll (e.g. `CoinTrendPage`) should set `overflow: hidden` explicitly rather than relying on inner components to behave.

## Community Comment Threads

`PostDetailPage` (`/community/post/:postId`) shows the full post at the top and a flat, floor-numbered comment thread below it.

- **Floors are flat, not nested** — every comment is a top-level reply to the post; there is no reply-to-comment UI. This matches `api.yaml`'s `CommentItem.floor` contract: 1F is the earliest comment, floors are assigned once at creation and never renumbered even if an earlier comment is deleted.
- **Floor order = chronological order** — comments are appended to the end of the list (`floor: prev.length + 1`), so rendering the array in order is sufficient; no separate sort step needed.
- Comments support their own **like** and **tip** (via `TipButton`), completely independent from the parent post's counts — liking a comment never changes the post's `like_count`.
- Both posts and comments can carry up to 4 **images**. Images are mocked client-side via `URL.createObjectURL()` in `CommentComposer` (no real upload endpoint wired yet); `api.yaml` models them as plain `image` URL arrays on `PostItem`/`CommentItem`/`CreatePostRequest`/`addComment` request body, to be replaced by real uploaded URLs later.
- `PostCard` is fully clickable to navigate to the detail page; every action button inside it (like, tip, copy-trade, share) calls `stopPropagation()` so clicking them doesn't also trigger navigation.
- `frontend/src/utils/mockCommunity.js` is the single source of mock post/comment data — both `CommunityPage` (feed) and `PostDetailPage` (thread) import from it so a post's `comments` count in the feed always matches its actual `commentList.length` on the detail page.

## Indicator Panel Sync

`IndicatorPanel` renders a second `lightweight-charts` instance for the selected technical indicator (MACD/RSI/MA/EMA/BOLL/KDJ/STOCH/VOL/OBV/ATR, computed in `utils/indicators.js` from the same candle data as the main chart).
- It receives the main chart's actual visible time range (`{ from, to }` timestamps, not fractions) via a `visibleTimeRange` prop from `CoinTrendPage` and calls `setVisibleRange` to match exactly.
- `handleScroll: false` and `handleScale: false` are set on the indicator chart — it is strictly read-only and cannot be dragged/zoomed independently of the main chart.

## Key Conventions

- **Config is source of truth**: `agentcore/agentcore.json` defines agents, memories, credentials, gateways. Never edit generated CDK code directly.
- **Flat resource model**: All AgentCore resources are independent top-level arrays. No nesting.
- **Naming = Identity**: Resource `name` fields map to CloudFormation Logical IDs. Renaming destroys + recreates.
- **Secrets**: API keys go in `agentcore/.env.local` (gitignored). Never commit secrets.
- **api.yaml is the single source of truth for the API contract.** Before adding a new endpoint, grep `backend/api.yaml` first — duplicate/conflicting path or schema definitions have happened before (e.g. `/coin/price` was defined twice with different response shapes) when steering docs and actual handler code drifted apart. When a handler already exists in `backend/src/handlers/`, the spec must match that implementation, not a hypothetical one.
- **CoinMarketCap keyless `listings/latest` returns `quote` as a LIST, not a dict.** Unlike the authenticated Pro API (`quote.USD.percent_change_24h`), the keyless public endpoint's `quote` field is `[{"symbol": "USD", "percent_change_24h": ..., ...}]` — find the entry by `symbol == "USD"` rather than indexing `quote["USD"]` directly. Also, never sort the full CMC universe directly by `percent_change_24h` for "top movers" — near-zero-market-cap tokens post meaningless four-digit % swings; rank within a market-cap-ranked pool instead (see `market_overview.py`'s `_RANKING_POOL_SIZE`).
- **New Lambda handlers must be registered in `backend/template.yaml`** (SAM function + API Gateway route) in addition to matching `api.yaml` — the spec alone does not deploy anything.
- **API contract**: Frontend/backend communicate via REST endpoints. Core endpoints:
  - `GET /init` — check CSV status
  - `POST /upload_csv` — upload + trigger analysis
  - `GET /coin/price` — real-time single-currency ticker (MAX API)
  - `GET /market/fear-greed` — Fear & Greed Index, latest or historical (CoinMarketCap)
  - `GET /market/overview` — 行情看板: Fear & Greed + BTC dominance + market cap/volume + top gainers/losers (CoinMarketCap, keyless)
  - `GET /candlestick_chart` — K-line + trade markers
  - `POST /ai_chat` — AI conversation
  - `POST /allow_trade` — confirm trade execution
  - `GET/POST /personality`, `/personality/reanalyze` — 4-axis personality profile
  - `GET/POST /community/feed`, `/community/post`, `/community/post/{id}/like`, `/community/post/{id}/comments`, `/community/post/{id}/comments/{commentId}/like`
  - `POST /tipping` — virtual point tip on a post or comment
  - `GET/POST /chat/{symbol}/messages`, `/chat/{symbol}/send` — chat/danmaku
  - `GET/POST /questionnaire`, `/questionnaire/submit`
  - `GET /recommend/coins`, `/recommend/similar-users`
  - `GET /user/profile`, `PUT /user/settings`

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
