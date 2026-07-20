# Product Summary

**智慧投資 L.I.V.E.** — An AI-powered cryptocurrency investment assistant for the 2026 雲湧智生 Taiwan Generative AI Hackathon.

- 命題單位: MaiCoin 現代財富科技股份有限公司
- 命題類別: 智慧理財 — 打造現代 AI 投資工具
- 決賽日期: 2026/08/01

## One-Liner

> 第一個認識你、分析你、然後幫你下單的 AI 投資助理。

## Core Concept

A YouTube live-stream styled interface where each cryptocurrency is a "channel." The AI analyzes the user's personal trading habits from CSV records to produce an investor personality profile (similar to MBTI), then delivers personalized market analysis, trade suggestions, and order execution through natural-language conversation.

## Key Features (Priority Order)

| Priority | Feature | Purpose |
|----------|---------|---------|
| P0 (Week 1) | YouTube-style Live UI | Visual impact, first impression for judges |
| P0 (Week 1) | Investor Personality System | Core differentiator from competitors |
| P1 (Week 2) | AI Conversational Trading | Technical depth — closed-loop order execution |
| P2 (Stretch) | Brilliant/Blunder Review | Chess.com-style trade retrospective |

## Investor Personality Types

| Type | Traits | Behavior |
|------|--------|----------|
| 🦁 熱衷型 (Enthusiastic) | High-frequency, short holds | Panic-sells during fear |
| 🐢 安逸型 (Comfortable) | Stablecoin-heavy, low-frequency | Misses rallies but rarely loses |
| 🦊 保守型 (Conservative) | Selective entry, waits for conditions | High win-rate, low frequency |
| 🎲 冒險型 (Gambler) | Concentrated bets, single-coin | Big wins or big losses |

Personality is non-binary — AI reports primary + secondary types.

## Target Users

Active crypto traders on MAX Exchange who trade frequently but lack systematic analysis of their own behavior.

## External Integrations

| Service | Usage |
|---------|-------|
| MAX Exchange API | Real-time pricing, K-line data, depth chart |
| MAX Skill | Trade execution (buy/sell orders) |
| MAX Private API | Extended market data (bonus points for Lv2 account) |
| CoinMarketCap API | Fear & Greed Index |
| AWS Bedrock (Claude) | AI reasoning, personality analysis, market analysis |
| AWS S3 | CSV storage, personality data persistence |

## API Contract (Frontend ↔ Backend)

| Path | Method | Purpose |
|------|--------|---------|
| `/init` | GET | Check if user needs to upload CSV |
| `/upload_csv` | POST | Upload CSV, trigger personality analysis |
| `/candlestick_chart` | GET | Get K-line data + trade markers |
| `/ai_chat` | POST | User ↔ AI conversation |
| `/allow_trade` | POST | User confirms trade execution |

## Critical Design Principles

- **AI never auto-executes trades** — all orders require explicit user confirmation.
- **Python does math, AI does interpretation** — CSV metrics are computed in Python, then sent to Bedrock for personality/analysis.
- **Retry policy**: All external API calls retry up to 3 times before returning error to frontend.
- **Personalization first**: Every recommendation is filtered through the user's personality profile and historical win rate.

## Hackathon Scoring Alignment

| Weight | Criterion | Our Response |
|--------|-----------|--------------|
| 25% | Creativity | YouTube live-stream UI + personality system |
| 20% | Technical Feasibility | AWS Bedrock + AgentCore + MAX API + S3 |
| 20% | Business Viability | Solves real pain: personalized insight for active traders |
| 15% | AI Design | Context-aware agent with tools, proactive suggestions |
| 10% | Topic Fit | Full use of GenAI + Agent + MAX API |
| 10% | Completeness | End-to-end demo: upload → analyze → trade |
| +5% | MAX Lv2 Private API | Planned |
| +5% | AWS Kiro IDE | In use |
