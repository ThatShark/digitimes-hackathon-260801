# Product Summary

**智慧投資 LIVE** — An AI-powered cryptocurrency investment assistant built for the 2026 Taiwan Generative AI Hackathon (命題單位: MaiCoin).

## Core Concept

A YouTube live-stream styled interface where each cryptocurrency is a "channel." The AI analyzes the user's personal trading habits to produce an investor personality profile (similar to MBTI), then delivers personalized market analysis, trade suggestions, and order execution through natural-language conversation.

## Key Features

1. **Investor Personality System** — Analyzes historical CSV trade records to classify the user into personality types (熱衷型/安逸型/保守型/冒險型) and tailors all recommendations accordingly.
2. **Live-Stream UI** — Main page shows coin "channels" (YouTube-style thumbnails); clicking opens a K-line chart as "live video" with an AI chat panel as the "chat room."
3. **Conversational Trading** — Users discuss trades with the AI in natural language; after confirmation, the system executes via MAX Exchange API / MAX Skill.
4. **Personalized Market Analysis** — Combines market sentiment (Fear & Greed Index), technical indicators, and the user's historical win rate for buy/sell suggestions.

## Target Users

Active crypto traders on the MAX Exchange who trade frequently but lack systematic analysis of their own behavior.

## External Integrations

- MAX Exchange API (real-time pricing, K-line data, order execution)
- MAX Skill (trade execution)
- CoinMarketCap API (Fear & Greed Index)
- AWS Bedrock / Claude (AI reasoning)
