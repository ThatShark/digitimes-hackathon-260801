# Product Summary

**智慧投資 L.I.V.E.** — An AI-powered cryptocurrency investment assistant for the 2026 雲湧智生 Taiwan Generative AI Hackathon.

- 命題單位: MaiCoin 現代財富科技股份有限公司
- 命題類別: 智慧理財 — 打造現代 AI 投資工具
- 決賽日期: 2026/08/01

## One-Liner

> 第一個認識你、分析你、然後幫你下單的 AI 投資助理。

## Core Concept

A YouTube/Bilibili live-stream styled interface where each cryptocurrency is a "channel." The AI analyzes the user's personal trading habits from CSV records to produce an investor personality profile (MBTI-style 4-axis system), then delivers personalized market analysis, trade suggestions, and order execution through natural-language conversation. A community layer with danmaku (barrage) chat and social feed lets users see other investors' sentiment in real time.

## Key Features (Priority Order)

| Priority | Feature | Purpose |
|----------|---------|---------|
| P0 (Week 1) | YouTube/Bilibili-style Live UI + Danmaku | Visual impact, first impression for judges |
| P0 (Week 1) | MBTI-style 4-axis Personality System | Core differentiator — title/badge system |
| P1 (Week 2) | AI Conversational Trading | Technical depth — closed-loop order execution |
| P1 (Week 2) | Community / Social Feed (Threads-style) | Social engagement, sentiment sharing |
| P1 (Week 2) | Algorithm-driven Feed Ranking | Personalized content surfacing |
| P2 (Stretch) | Questionnaire System | Periodic personality recalibration |
| P2 (Stretch) | Brilliant/Blunder Review | Chess.com-style trade retrospective |

---

## Investor Personality System (MBTI-style, 4 axes)

The personality system uses **4 independent axes**, each with two poles. A user's personality is a combination of where they fall on each axis (like MBTI's 4 letters). This replaces the previous 4-type model.

### The 4 Axes

| Axis | Pole A | Pole B | What it measures |
|------|--------|--------|------------------|
| 1. 頻率 (Frequency) | 熱衷 (Active) — high-frequency, short holds | 安逸 (Passive) — low-frequency, long holds | How often the user trades |
| 2. 風險 (Risk) | 冒險 (Aggressive) — concentrated bets, high volatility | 保守 (Conservative) — diversified, low volatility | Risk tolerance |
| 3. 策略 (Strategy) | 計畫 (Planned) — consistent returns, stable strategy | 渾沌 (Chaotic) — erratic returns, no clear pattern | Strategy consistency |
| 4. 情緒 (Sentiment) | 逆勢 (Contrarian) — buys in fear, sells in greed | 追勢 (Trend-follower) — chases momentum | Reaction to market sentiment |

### Personality as Title/Badge

- Each user gets a 4-letter code (e.g. 「熱冒計逆」) displayed as a **title/prefix** before their username.
- Titles appear in: community posts, chat messages, danmaku (barrage), and profile.
- The title is visible to other users — creates social identity and recognition.

### Personality Determination

- **Primary source**: CSV trade record analysis (Python computes metrics → Bedrock interprets).
- **Secondary source**: Questionnaire responses (periodic recalibration).
- **Per-coin variation**: AI may note different tendencies per coin (e.g. "你對 BTC 偏安逸，但對 SOL 偏熱衷").

---

## UI Design

### Main Page (YouTube-style Home)

- Grid of coin "channel" cards — only coins the user has traded or follows.
- Each card shows: coin name, a mini K-line chart as thumbnail (recent trend), current price.
- Click a card → enter that coin's live stream page.
- **Feed algorithm** determines card order:
  - **平時關注** (Your Focus): AI analyzes user's trading frequency per coin, surfaces most relevant first.
  - **熱門** (Trending): Most-watched/traded across all users.
  - **潛力** (Rising): Coins with high recent attention growth rate.

### Live Stream Page (Coin Detail)

```
┌─────────────────────────────┬──────────────────────┐
│                             │  [AI Chat Tab]       │
│   K-line Chart              │  [Community Chat Tab]│
│   (main "video" area)       │                      │
│                             │  AI: consultation,   │
│   ▲ buy markers             │  suggestions, trade  │
│   ▼ sell markers            │  confirmation        │
│   Danmaku overlay (toggle)  │                      │
│                             │  Community: real-time│
│   [Progress bar / scrubber] │  messages from other │
│   [Time scale: D / M / Y]  │  users, sentiment    │
│                             │                      │
├─────────────────────────────┤                      │
│ Controls:                   │                      │
│ • Toggle danmaku on/off     │                      │
│ • Danmaku size adjustment   │                      │
│ • Time interval (日/月/年)  │                      │
│ • Indicator toggles (off    │                      │
│   by default)               │                      │
└─────────────────────────────┴──────────────────────┘
```

**Key design points:**
- Progress bar can scrub backward in time.
- Time scale selector: 日 (daily, 24h), 月 (monthly, 30d), 年 (yearly, 365d).
- Technical indicators (MACD, RSI, etc.) exist but are **off by default** — user opts in.
- Danmaku (彈幕): community chat messages fly across the K-line chart area (like Bilibili). Toggle on/off, adjust size.

### Right Panel: Dual Chat System

1. **AI Chat (諮詢)**: Private consultation with the AI assistant. AI provides personalized analysis, trade suggestions. When AI proposes a trade with all parameters set, user must press a **confirm button** to execute.
2. **Community Chat (聊天室)**: Public messages from all users watching this coin. Messages can optionally display as danmaku on the chart. Shows each user's personality title as prefix.

### Social/Community Page (Threads-style)

- A separate page with a Threads-like social feed.
- Users can post thoughts, analysis, trade rationale.
- Each post shows the user's personality title prefix.
- **Feed algorithm**:
  - Prioritize posts about coins the user follows.
  - Prioritize posts from users with the **same personality type**.
  - Surface high-engagement posts (likes, replies).
  - Trending topics across all users.

---

## Questionnaire System

- **When**: Offered at registration (skippable). Reappears periodically in the social feed like an ad/prompt — never blocks the user.
- **Format**: Different questions each time (not repetitive).
- **Feedback after completion**:
  - "你是 XX 型投資人" (personality result).
  - "你的人格近期有小/大幅度的轉變，是否願意提供轉變的理由？" (if personality shifted).
- **Purpose of "why" follow-up**: User-provided reasoning lets AI better predict how the user's habits change under different market conditions.
- **Data usage**: Questionnaire answers supplement CSV analysis — used to recalibrate personality axes.

---

## AI Behavior

### Passive Mode (Default)

- AI does **not** proactively interrupt the user unless asked.
- The algorithm handles passive recommendations (feed ranking, coin suggestions).
- AI waits for the user to open AI chat and ask a question.

### Active Mode (When User Initiates Consultation)

When the user asks the AI for advice:
1. AI analyzes based on: user's personality, historical win rate, market data (MAX API), Fear & Greed Index (CoinMarketCap), current holdings.
2. AI provides a recommendation with reasoning.
3. If AI proposes a trade: sets all parameters (coin, action, amount) → user must press **confirm** to execute.
4. **AI never auto-executes trades.**

### When AI Doesn't Know

If AI lacks sufficient data about a specific situation:
- Reference how **trending/popular users** are trading.
- Reference how users with the **same personality type** are trading.
- Reference how users who **follow the same coins** are trading.
- Clearly state the basis: "根據與你相似的投資人近期操作..."

---

## Algorithm / Recommendation Engine

| Context | Algorithm |
|---------|-----------|
| Main page coin order | User's trading frequency per coin → most relevant first |
| Main page "熱門" | Global trading volume / attention across all users |
| Main page "潛力" | Coins with highest recent attention growth rate |
| Social feed | Same-coin priority → same-personality priority → high-engagement |
| AI suggestions | User personality + market data + similar-user behavior as fallback |

---

## External Integrations

| Service | Usage |
|---------|-------|
| MAX Exchange API | Real-time pricing, K-line data, depth chart |
| MAX Skill | Trade execution (buy/sell orders) |
| MAX Private API | Extended market data (bonus points for Lv2 account) |
| CoinMarketCap API | Fear & Greed Index |
| AWS Bedrock (Claude) | AI reasoning, personality analysis, market analysis |
| AWS S3 | CSV storage, personality data persistence, chat history |

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

> Note: Additional endpoints may be needed for community features (posts, chat, questionnaire). TBD.

## Critical Design Principles

- **AI never auto-executes trades** — all orders require explicit user confirmation via confirm button.
- **Python does math, AI does interpretation** — CSV metrics are computed in Python, then sent to Bedrock for personality/analysis.
- **Retry policy**: All external API calls retry up to 3 times before returning error to frontend.
- **Personalization first**: Every recommendation is filtered through the user's personality profile and historical win rate.
- **Indicators off by default**: Technical indicators exist but don't clutter the UI unless user enables them.
- **Personality is social**: Titles are visible to others — creates identity and community.
- **AI is passive by default**: No unsolicited interruptions. User initiates consultation.

## Hackathon Scoring Alignment

| Weight | Criterion | Our Response |
|--------|-----------|--------------|
| 25% | Creativity | YouTube/Bilibili live UI + danmaku + MBTI personality titles + social feed |
| 20% | Technical Feasibility | AWS Bedrock + AgentCore + MAX API + S3 + recommendation algorithm |
| 20% | Business Viability | Solves real pain: personalized insight + social layer for active traders |
| 15% | AI Design | Context-aware agent, personality-based advice, similar-user fallback |
| 10% | Topic Fit | Full use of GenAI + Agent + MAX API + community |
| 10% | Completeness | End-to-end demo: upload → analyze → trade + social |
| +5% | MAX Lv2 Private API | Planned |
| +5% | AWS Kiro IDE | In use |
