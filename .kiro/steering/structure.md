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
│       │   └── QuestionnairePage.jsx # Personality questionnaire flow
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx          # Side navigation
│       │   │   └── SearchBar.jsx        # Top search bar
│       │   ├── main/
│       │   │   ├── CoinCard.jsx         # Coin thumbnail card (used in 平時關注/熱門/潛力)
│       │   │   └── HotPostCard.jsx      # Community post preview card
│       │   ├── trend/
│       │   │   ├── KLineChart.jsx       # K-line chart (lightweight-charts)
│       │   │   ├── ProgressBar.jsx      # Draggable time progress bar
│       │   │   ├── ChartSettings.jsx    # Danmaku toggle, size, time scale (時/日/周)
│       │   │   ├── IndicatorPanel.jsx   # Technical indicators (default off)
│       │   │   ├── TradePanel.jsx       # Order execution panel (買賣)
│       │   │   ├── AIChatPanel.jsx      # AI conversation tab
│       │   │   └── DanmakuPanel.jsx     # Barrage/chat room tab (Bilibili-style)
│       │   ├── community/
│       │   │   ├── PostCard.jsx         # Single post with personality prefix
│       │   │   ├── PostComposer.jsx     # Create new post
│       │   │   └── QuestionnaireCard.jsx # Questionnaire "ad card" in feed
│       │   └── shared/
│       │       ├── PersonalityBadge.jsx  # Personality type prefix/title display
│       │       └── DanmakuOverlay.jsx    # Danmaku overlay on K-line chart
│       ├── hooks/                # Custom React hooks
│       │   ├── useKLineData.js
│       │   ├── useDanmaku.js
│       │   └── useCommunityFeed.js
│       ├── services/             # API call wrappers
│       │   ├── api.js            # Base axios/fetch config
│       │   ├── chartApi.js       # /candlestick_chart
│       │   ├── aiApi.js          # /ai_chat
│       │   ├── tradeApi.js       # /allow_trade
│       │   ├── communityApi.js   # /community, /danmaku
│       │   └── questionnaireApi.js # /questionnaire
│       └── styles/               # CSS / style files
│
├── backend/                     # AWS Lambda backend
│   └── src/
│       ├── handlers/
│       │   ├── init.py              # GET /init
│       │   ├── upload_csv.py        # POST /upload_csv
│       │   ├── candlestick_chart.py # GET /candlestick_chart
│       │   ├── ai_chat.py          # POST /ai_chat
│       │   ├── allow_trade.py      # POST /allow_trade
│       │   ├── community.py        # GET/POST /community
│       │   ├── danmaku.py          # GET/POST /danmaku
│       │   └── questionnaire.py    # GET/POST /questionnaire
│       ├── services/
│       │   ├── max_api.py           # MAX Exchange API client
│       │   ├── coinmarketcap.py     # CoinMarketCap API client
│       │   ├── s3_storage.py        # S3 read/write utilities
│       │   ├── personality.py       # Personality calculation logic
│       │   └── recommendation.py    # Feed recommendation algorithm
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
        └── hackthon_rule.md     # Competition rules & scoring
```

## Frontend Pages & Components

### Pages

| Page | Route | Description |
|------|-------|-------------|
| MainPage | `/` | YouTube-style homepage with coin cards in sections (平時關注, 熱門, 潛力, 社群貼文) |
| CoinTrendPage | `/coin/:symbol` | Live stream page — K-line chart + AI chat + danmaku + trade panel |
| CommunityPage | `/community` | Threads-style social feed with personality-weighted algorithm |
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
│   Indicator Panel            │   Trade Panel      │
│   (default: off)             │   (買賣確認)        │
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
- **API contract**: Frontend/backend communicate via REST endpoints. Core 5 defined in `Proposal.md` Section IV:
  - `GET /init` — check CSV status
  - `POST /upload_csv` — upload + trigger analysis
  - `GET /candlestick_chart` — K-line + trade markers
  - `POST /ai_chat` — AI conversation
  - `POST /allow_trade` — confirm trade execution
  - (Additional endpoints TBD for community, chat, questionnaire features)

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
