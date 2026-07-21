# Product Summary

**智慧投資 L.I.V.E.** — An AI-powered cryptocurrency investment assistant for the 2026 雲湧智生 Taiwan Generative AI Hackathon.

- 命題單位: MaiCoin 現代財富科技股份有限公司
- 命題類別: 智慧理財 — 打造現代 AI 投資工具
- 決賽日期: 2026/08/01

## One-Liner

> 第一個認識你、分析你、然後幫你下單的 AI 投資助理。

## Core Concept

A YouTube live-stream styled interface where each cryptocurrency is a "channel." The AI analyzes the user's personal trading habits (from CSV records + questionnaire) to produce an investor personality profile (MBTI-style with 4 dimensions), then delivers personalized market analysis, trade suggestions, and order execution through natural-language conversation. A community system (Threads-style) lets investors interact with real-time danmaku (barrage) and social posts, with personality types shown as name prefixes.

## Key Features (Priority Order)

| Priority | Feature | Purpose |
|----------|---------|---------|
| P0 (Week 1) | YouTube-style Live UI | Visual impact, first impression for judges |
| P0 (Week 1) | Investor Personality System (MBTI-style) | Core differentiator — 4 dimensions, shown as prefix/title |
| P1 (Week 2) | AI Conversational Trading | Technical depth — closed-loop order execution |
| P1 (Week 2) | Community Page (Threads-style) | Social engagement, danmaku, personality-based feed |
| P1 (Week 2) | Recommendation Algorithm | AI-driven personalized feed ordering |
| P2 (Stretch) | Questionnaire System | Periodic personality refinement + shift detection |
| P2 (Stretch) | Brilliant/Blunder Review | Chess.com-style trade retrospective |

## Investor Personality System (MBTI-style)

### Design Philosophy

Like MBTI, the personality system has **4 independent dimensions**. Each dimension places the user on a spectrum between two poles. The combination of 4 dimensions produces a personality "type code" (e.g., similar to INTJ/ENFP in MBTI).

### Four Dimensions

| Dimension | Pole A | Pole B | What it measures |
|-----------|--------|--------|------------------|
| 頻率 (Frequency) | 熱衷型 (High-frequency) | 安逸型 (Low-frequency) | Trading frequency & hold duration |
| 風險 (Risk) | 冒險型 (Risk-seeking) | 保守型 (Risk-averse) | Position concentration & loss tolerance |
| 策略 (Strategy) | 計劃型 (Systematic) | 渾沌型 (Chaotic) | Consistency of returns & cross-coin behavior |
| 情緒 (Sentiment) | 理性型 (Rational) | 衝動型 (Impulsive) | Tendency to chase pumps / panic-sell |

### Personality as Social Identity

- Personality type displayed as a **prefix/title** before username (e.g., `[熱衷·計劃] 使用者名稱`)
- Visible in community posts, danmaku/barrage comments, and chat rooms
- Enables personality-based social matching and feed recommendations

### Personality Evolution

- Personality is not static — AI tracks shifts over time
- Questionnaire system provides additional signals for refinement
- AI reports when significant personality shifts are detected

## Page Structure

### 1. Main Page (YouTube Homepage Style)

Layout: Side navigation + content area with search bar

| Section | Content | Algorithm |
|---------|---------|-----------|
| 平時關注 (Following) | Coins the user frequently trades | AI analyzes user's trading history |
| 熱門 (Trending) | Popular coins across all users | Aggregate trading volume & attention |
| 潛力 (Potential) | Coins with rising attention (optional) | Recent attention growth rate |
| 熱門社群貼文 (Hot Posts) | Community posts with high engagement | Like count, same-personality priority |

Each coin card shows: coin name, thumbnail (recent K-line preview), current price.

### 2. Coin Trend Page (Live Stream Style)

```
┌──────────────────────────────┬────────────────────┐
│                              │ [AI對話] [彈幕留言]  │ ← Tab switcher
│                              │                    │
│   幣種走勢 (K-line chart)     │   Chat panel       │
│   Large area, main focus     │   (AI or Danmaku)  │
│                              │                    │
│   Progress bar (draggable)   │                    │
│   Settings: danmaku on/off,  │                    │
│   danmaku size, time scale   │                    │
│   (時/日/周)                  │                    │
│                              │                    │
├──────────────────────────────┼────────────────────┤
│                              │                    │
│   分析指標 (Indicators)       │   買賣 (Trade)     │
│   Default: collapsed/off     │   Order panel      │
│                              │                    │
└──────────────────────────────┴────────────────────┘
```

**Left panel (top):** K-line chart with draggable progress bar. Time interval selector (時/日/周). Danmaku settings (toggle, size).

**Left panel (bottom):** Technical indicators panel. Default OFF, user can enable as needed.

**Right panel (top):** Dual-tab chat system:
- **AI 對話 tab:** Personal AI advisor. Provides personalized analysis and trade suggestions. If AI proposes a trade with all parameters set, user must press confirm button to execute.
- **彈幕留言 tab:** Community barrage/chat (Bilibili-style). Messages from other investors scroll across the K-line chart as danmaku when enabled. Users can also browse messages in the chat panel. Each message shows sender's personality prefix.

**Right panel (bottom):** Trade execution panel for confirmed orders.

### 3. Community Page (Threads-style)

- Feed of investor posts, opinions, and market commentary
- Each post displays user's personality type prefix
- Feed algorithm prioritizes:
  1. Posts from users with the same personality type
  2. Posts about coins the user follows
  3. High-engagement posts (likes, replies)
- Questionnaire cards appear periodically (like ads) in the feed

### 4. Questionnaire System

- Optional at registration (can be skipped)
- Appears periodically as "ad cards" in community feed — never disappears permanently
- Each appearance can have different questions
- After completion, provides feedback:
  - "你是 [personality type]"
  - "你的人格近期有著小/大幅度的轉變，是否願意提供轉變的理由？"
- User-provided reasons help AI better predict behavior changes in different market conditions

## Recommendation Algorithm

### Coin Feed (Main Page)

| Category | Logic |
|----------|-------|
| 平時關注 | AI analyzes user's historical trades → prioritize frequently traded coins |
| 熱門 | Aggregate analysis of what most users are watching/trading |
| 潛力 (optional) | Coins with rapidly increasing attention in recent period |

### Community Feed

| Priority | Signal |
|----------|--------|
| 1st | Same personality type as user |
| 2nd | Posts about coins user follows |
| 3rd | High engagement (likes, replies) |

### AI Behavior

- **Passive by default** — AI only proactively analyzes via algorithm recommendations, not unsolicited advice
- **Active on consultation** — When user asks AI directly, it provides personalized advice based on:
  1. User's personality profile & trading history
  2. Current market conditions (MAX API + CoinMarketCap)
  3. User's historical win rate in similar conditions
- **Fallback strategy** — When AI lacks sufficient data about the user, it references:
  1. Popular/majority behavior (what most users are doing)
  2. Behavior of users with the same personality type
  3. Behavior of users following the same coins

## Target Users

Active crypto traders on MAX Exchange who trade frequently but lack systematic analysis of their own behavior.

## External Integrations

| Service | Usage |
|---------|-------|
| MAX Exchange API | Real-time pricing, K-line data, depth chart |
| MAX Skill | Trade execution (buy/sell orders) |
| MAX Private API | Extended market data (bonus points for Lv2 account) |
| CoinMarketCap API | Fear & Greed Index |
| AWS Bedrock (Claude) | LLM reasoning — personality analysis, market analysis, conversational trading |
| AWS S3 | CSV storage, personality data, chat history, community posts |

## API Contract (Frontend ↔ Backend)

| Path | Method | Purpose |
|------|--------|---------|
| `/init` | GET | Check if user needs to upload CSV |
| `/upload_csv` | POST | Upload CSV, trigger personality analysis |
| `/candlestick_chart` | GET | Get K-line data + trade markers |
| `/ai_chat` | POST | User ↔ AI conversation |
| `/allow_trade` | POST | User confirms trade execution |
| `/community` | GET | Fetch community feed (personality-weighted) |
| `/community/post` | POST | Create a community post |
| `/questionnaire` | GET | Fetch current questionnaire |
| `/questionnaire` | POST | Submit questionnaire answers |
| `/danmaku` | GET | Fetch danmaku messages for a coin |
| `/danmaku` | POST | Send a danmaku message |

## Critical Design Principles

- **AI never auto-executes trades** — all orders require explicit user confirmation button press.
- **Python does math, AI does interpretation** — CSV metrics are computed in Python, then sent to Bedrock for personality/analysis.
- **Retry policy**: All external API calls retry up to 3 times before returning error to frontend.
- **Personalization first**: Every recommendation is filtered through the user's personality profile and historical win rate.
- **Passive AI, active on demand**: AI does not push unsolicited advice; it responds to user consultation or operates within algorithm-driven recommendations.
- **Personality is social**: Personality types are visible to the community and drive social interactions.

## Hackathon Scoring Alignment

| Weight | Criterion | Our Response |
|--------|-----------|--------------|
| 25% | Creativity | YouTube live-stream UI + MBTI personality + danmaku + community |
| 20% | Technical Feasibility | AWS Bedrock + AgentCore + MAX API + S3 + real-time danmaku |
| 20% | Business Viability | Solves real pain: personalized insight + social engagement for active traders |
| 15% | AI Design | Context-aware agent with tools, personality-driven recommendations, crowd fallback |
| 10% | Topic Fit | Full use of GenAI + Agent + MAX API |
| 10% | Completeness | End-to-end demo: upload → analyze → trade → community |
| +5% | MAX Lv2 Private API | Planned |
| +5% | AWS Kiro IDE | In use |
