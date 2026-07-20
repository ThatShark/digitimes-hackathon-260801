# Project Structure

```
digitimes-hackathon-260801/
├── README.md                    # Project overview (Chinese)
├── Proposal.md                  # Internal design doc — full feature specs, API docs, team roles
├── package.json                 # Root-level (minimal)
│
├── frontend/                    # React + Vite frontend
│   └── src/                     # (scaffolding stage)
│
├── backend/                     # AWS Lambda backend
│   └── src/                     # (scaffolding stage)
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

## Key Conventions

- **Config is source of truth**: `agentcore/agentcore.json` defines agents, memories, credentials, gateways. Never edit generated CDK code directly.
- **Flat resource model**: All AgentCore resources are independent top-level arrays. No nesting.
- **Naming = Identity**: Resource `name` fields map to CloudFormation Logical IDs. Renaming destroys + recreates.
- **Secrets**: API keys go in `agentcore/.env.local` (gitignored). Never commit secrets.
- **API contract**: Frontend/backend communicate via 5 REST endpoints defined in `Proposal.md` Section IV:
  - `GET /init` — check CSV status
  - `POST /upload_csv` — upload + trigger analysis
  - `GET /candlestick_chart` — K-line + trade markers
  - `POST /ai_chat` — AI conversation
  - `POST /allow_trade` — confirm trade execution

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
| 林志恩 | Frontend: live stream page (K-line + chat) |
| 郭凱明 | Frontend: main page (coin cards + CSV upload) |
| 趙文睿 | Backend A: AWS infra, API Gateway, MAX/CMC API |
| 薛宇宏 | Backend B: AI core, Bedrock, personality analysis |
