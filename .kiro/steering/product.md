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
| P1 (Week 2) | Social Copy Trading (實盤跟單) | 貼文即訂單 + 實盤驗證，展示 MAX Skill 閉環 |
| P1 (Week 2) | $Ticker Cards + Sentiment Analysis | 嵌入式即時數據卡片 + AI 情緒分析儀表 |
| P1 (Week 2) | Algorithm-driven Feed Ranking | Personalized content surfacing |
| P1 (Week 2) | Market Overview + Watchlist | 行情看板 + 自選清單，主頁資訊完整度 |
| P1 (Week 2) | Portfolio & Trade History | 資產總覽 + 交易明細，Profile 頁核心數據 |
| P1 (Week 2) | Advanced Orders (TP/SL) | 止盈止損單，AI 可主動建議設定 |
| P2 (Stretch) | Depth Chart + Recent Trades | 展示 MAX API 深度整合 |
| P2 (Stretch) | Notification System | 市場異動推播 + AI 提醒 |
| P2 (Stretch) | Whale Alert Bot | 模擬巨鯨警報 + 一鍵追買 |
| P2 (Stretch) | Micro-Economy (打賞 + 懸賞) | 虛擬積分制社群激勵 |
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

#### Market Overview (行情看板)

Top section of main page showing at-a-glance market data:
- 24h 漲幅榜 / 跌幅榜 (top gainers/losers)
- 24h 成交量排行
- Fear & Greed Index (from CoinMarketCap)
- BTC dominance / total market cap

#### Watchlist (自選清單)

- User can add/remove coins to personal watchlist (beyond CSV-traded coins).
- Watchlist persists in S3: `users/{userId}/watchlist.json`
- Watchlist coins appear in「平時關注」section alongside CSV-derived coins.
- Quick-add from Market Overview or search results.

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
├─────────────────────────────┤                      │
│ [Depth Chart] [Recent Trades]                      │
│ (collapsible below K-line)  │                      │
└─────────────────────────────┴──────────────────────┘
```

**Key design points:**
- Progress bar can scrub backward in time.
- Time scale selector: 日 (daily, 24h), 月 (monthly, 30d), 年 (yearly, 365d).
- Technical indicators (MACD, RSI, etc.) exist but are **off by default** — user opts in.
- Danmaku (彈幕): community chat messages fly across the K-line chart area (like Bilibili). Toggle on/off, adjust size.
- **Depth Chart (深度圖)**: collapsible panel below K-line, shows buy/sell order book depth from MAX API.
- **Recent Trades (最新成交)**: real-time trade stream from MAX API, displayed alongside depth chart.

### Right Panel: Dual Chat System

1. **AI Chat (諮詢)**: Private consultation with the AI assistant. AI provides personalized analysis, trade suggestions. When AI proposes a trade with all parameters set, user must press a **confirm button** to execute.
2. **Community Chat (聊天室)**: Public messages from all users watching this coin. Messages can optionally display as danmaku on the chart. Shows each user's personality title as prefix.

### Trade Panel (交易面板)

Enhanced order types beyond basic market/limit:
- **市價單 (Market Order)**: Immediate execution at current price.
- **限價單 (Limit Order)**: Set target price, wait for fill.
- **止盈止損 (TP/SL)**: AI can proactively suggest TP/SL levels based on user's personality and historical volatility. User sets take-profit and stop-loss prices; system monitors and executes via MAX Skill.
- **AI 建議模式**: When user asks AI for trade advice, AI may pre-fill order parameters (including suggested TP/SL) — user confirms to execute.

All orders require explicit user confirmation. AI never auto-executes.

### Profile Page (個人頁面)

#### Portfolio Overview (資產總覽)
- Total portfolio value (all holdings × current price from MAX API).
- Per-coin breakdown: quantity held, avg buy price, current price, unrealized P&L (%).
- 24h portfolio change.
- Pie chart showing asset allocation.

#### Trade History (交易歷史)
- Full trade log from CSV: date, coin, action (buy/sell), price, quantity, realized P&L.
- Filterable by coin, date range, action type.
- Summary stats: total trades, win rate, avg holding period, best/worst trade.

#### Personality Profile
- 4-axis radar/bar chart showing personality scores.
- Per-coin personality variation notes.
- Questionnaire history and personality evolution timeline.

### Social/Community Page (Threads-style)

- A separate page with a Threads-like social feed.
- Users can post thoughts, analysis, trade rationale.
- Each post shows the user's personality title prefix.
- **Feed algorithm**:
  - Prioritize posts about coins the user follows.
  - Prioritize posts from users with the **same personality type**.
  - Surface high-engagement posts (likes, replies).
  - Trending topics across all users.

#### 實盤社交與跟單 (Social Copy Trading)

**實盤驗證標籤 (Verified PnL)**
- 用戶上傳 CSV 後，系統自動計算真實績效（勝率、累計損益、最大回撤）。
- 貼文自動附帶「✓ 實盤驗證」標籤 + 績效摘要卡片。
- 績效數據不可偽造——來自 CSV 原始交易記錄 + 人格系統計算結果。
- 其他用戶可看到發文者的人格類型 + 實盤勝率，建立信任。

**貼文即訂單 (Post-to-Trade / Copy Trade)**
- 當用戶發布包含明確交易方向的貼文（如「看多 $BTC，建議 95000 進場」），系統自動偵測並生成「跟隨此策略」按鈕。
- 跟單流程：粉絲點擊 → 設定投入金額 → 確認 → 透過 MAX Skill 執行下單。
- 跟單仍需用戶明確確認，不自動執行。
- AI 會額外提示：「此策略是否符合你的投資人格？」根據跟單者自身的風險軸判斷。

#### 嵌入式加密工具箱 (Embedded Crypto Tools)

**動態幣種 Tag ($Ticker 卡片)**
- 貼文或聊天中輸入 `$BTC`、`$ETH` 等，系統自動轉為互動式懸浮卡片。
- 卡片內容：幣種名稱、即時價格、24H 漲跌幅、迷你 K 線縮圖、買賣深度概覽。
- 點擊卡片可跳轉至該幣種的直播頁面。
- 同時支援社群貼文、彈幕留言、AI 對話中使用。

**巨鯨警報 Bot (Whale Alert)**
- 系統模擬監控鏈上大額轉帳（Demo 用 mock 數據定時播報）。
- 警報以特殊樣式卡片出現在社群 feed 和彈幕中。
- 警報附帶「一鍵追買」按鈕（跳轉到該幣種的 TradePanel）。
- 未來可串接真實鏈上數據 API。

**社群 AI 情緒分析 (Sentiment Analysis)**
- AI 自動掃描社群貼文與彈幕留言，即時計算每個幣種的「看多/看空比例」。
- 在直播頁面和社群頁面顯示情緒儀表盤 (Sentiment Gauge)。
- AI 可生成熱門討論的精簡摘要，作為 AI Chat 的參考上下文。
- 情緒數據也影響推薦算法：當群體情緒極端時，AI 會在諮詢時提醒用戶。

#### P2P 微型經濟 (Micro-Economy)

**微額打賞 (Tipping System)**
- 虛擬積分制（非真實鏈上代幣），降低 Demo 複雜度。
- 用戶可對優質分析貼文、熱心回答點擊「打賞」按鈕。
- 積分累計顯示在個人 Profile，作為社群聲望指標。
- 積分排行榜可作為「社群 KOL」的評判依據。

**付費懸賞提問 (Bounty Q&A)**
- 新手用戶發問時可附加積分賞金。
- 問題以特殊卡片形式出現在社群 feed（類似 QuestionnaireCard）。
- 回答被提問者採納後，積分自動划轉。
- AI 也可回答懸賞問題，但人工回答優先顯示。

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
| Main page coin order | User's trading frequency per coin + watchlist → most relevant first |
| Main page "熱門" | Global trading volume / attention across all users |
| Main page "潛力" | Coins with highest recent attention growth rate |
| Market Overview | 24h price change ranking from MAX API (gainers/losers/volume) |
| Social feed | Same-coin priority → same-personality priority → high-engagement → verified PnL boost |
| Social feed "跟單熱門" | Copy trade frequency + KOL verified win rate ranking |
| AI suggestions | User personality + market data + similar-user behavior as fallback |
| AI TP/SL suggestions | Historical volatility + user's avg holding period + personality risk axis |
| Sentiment gauge | AI NLP analysis of community posts + danmaku → bullish/bearish ratio per coin |
| Copy trade risk check | Compare strategy personality vs follower personality → warn if mismatch |

---

## External Integrations

| Service | Usage |
|---------|-------|
| MAX Exchange API | Real-time pricing, K-line data, depth chart, recent trades, order book |
| MAX Skill | Trade execution (market/limit/TP-SL orders) |
| MAX Private API | Extended market data, user balance query (bonus points for Lv2 account) |
| CoinMarketCap API | Fear & Greed Index, BTC dominance, total market cap |
| AWS Bedrock (Claude) | AI reasoning, personality analysis, market analysis, TP/SL suggestions |
| AWS S3 | CSV storage, personality data, chat history, watchlist, portfolio snapshots, sentiment cache, user points/tips |

## API Contract (Frontend ↔ Backend)

| Path | Method | Purpose |
|------|--------|---------|
| `/init` | GET | Check if user needs to upload CSV |
| `/upload_csv` | POST | Upload CSV, trigger personality analysis |
| `/candlestick_chart` | GET | Get K-line data + trade markers |
| `/ai_chat` | POST | User ↔ AI conversation |
| `/allow_trade` | POST | User confirms trade execution (market/limit/TP-SL) |
| `/community` | GET | Fetch community feed (personality-weighted) |
| `/community/post` | POST | Create a community post |
| `/questionnaire` | GET | Fetch current questionnaire |
| `/questionnaire` | POST | Submit questionnaire answers |
| `/danmaku` | GET | Fetch danmaku messages for a coin |
| `/danmaku` | POST | Send a danmaku message |
| `/market/overview` | GET | Market overview: gainers, losers, volume ranking |
| `/market/depth` | GET | Order book depth for a specific coin (proxy MAX API) |
| `/market/trades` | GET | Recent trades for a specific coin (proxy MAX API) |
| `/watchlist` | GET | Get user's watchlist |
| `/watchlist` | POST | Add/remove coin from watchlist |
| `/portfolio` | GET | User's portfolio: holdings, P&L, allocation |
| `/trade_history` | GET | User's trade history with filters |
| `/copy_trade` | POST | Execute copy trade (follow another user's strategy) |
| `/sentiment/:symbol` | GET | Community sentiment gauge for a coin (多/空比例) |
| `/whale_alerts` | GET | Recent whale alert events (mock data) |
| `/tipping` | POST | Send virtual tip (積分) to a post |
| `/bounty` | GET/POST | Bounty Q&A: create question with reward / submit answer |

## Critical Design Principles

- **AI never auto-executes trades** — all orders (including copy trades) require explicit user confirmation via confirm button.
- **Python does math, AI does interpretation** — CSV metrics are computed in Python, then sent to Bedrock for personality/analysis.
- **Retry policy**: All external API calls retry up to 3 times before returning error to frontend.
- **Personalization first**: Every recommendation is filtered through the user's personality profile and historical win rate.
- **Indicators off by default**: Technical indicators exist but don't clutter the UI unless user enables them.
- **Personality is social**: Titles are visible to others — creates identity and community.
- **AI is passive by default**: No unsolicited interruptions. User initiates consultation.
- **實盤 = 信任基礎**: CSV 數據即為實盤驗證，不可偽造。所有績效標籤來自真實計算。
- **跟單 ≠ 盲從**: Copy trade 前 AI 會比對策略發布者與跟單者的人格差異，提示風險。
- **積分非代幣**: 打賞與懸賞使用虛擬積分，不涉及鏈上資產轉移，降低合規風險。

## Hackathon Scoring Alignment

| Weight | Criterion | Our Response |
|--------|-----------|--------------|
| 25% | Creativity | YouTube/Bilibili live UI + danmaku + MBTI personality titles + social copy trading + $Ticker cards + sentiment gauge + micro-economy |
| 20% | Technical Feasibility | AWS Bedrock + AgentCore + MAX API + S3 + recommendation algorithm + NLP sentiment |
| 20% | Business Viability | Solves real pain: personalized insight + social layer + verified PnL + copy trading ecosystem |
| 15% | AI Design | Context-aware agent, personality-based advice, sentiment analysis, copy trade risk check |
| 10% | Topic Fit | Full use of GenAI + Agent + MAX API + community + social trading |
| 10% | Completeness | End-to-end demo: upload → analyze → trade → social → copy trade |
| +5% | MAX Lv2 Private API | Planned |
| +5% | AWS Kiro IDE | In use |
