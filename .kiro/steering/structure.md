# Project Structure

```
digitimes-hackathon-260801/
├── README.md                    # Project overview (Chinese)
├── Proposal.md                  # Internal design document with full specs
├── package.json                 # Root-level (minimal, npm dependency only)
│
├── frontend/                    # React + Vite frontend (in progress)
│   └── src/
│
├── backend/                     # AWS Lambda backend (in progress)
│   └── src/
│
└── .kiro/                       # Kiro IDE configuration
    └── steering/                # Steering rules (this directory)
```

## Key Conventions

- **Config is source of truth**: `agentcore/agentcore.json` defines agents, memories, credentials, and gateways. Do not modify generated CDK code directly.
- **Flat resource model**: All AgentCore resources (agents, memories, credentials, gateways) are independent top-level arrays. No nesting or binding between resources.
- **Naming**: Resource `name` fields determine CloudFormation Logical IDs. Renaming destroys and recreates resources.
- **Secrets**: API keys live in `agentcore/.env.local` (gitignored). Never commit secrets.
- **API contract**: Frontend/backend communicate via 5 REST endpoints (`/init`, `/upload_csv`, `/candlestick_chart`, `/ai_chat`, `/allow_trade`) defined in `Proposal.md` Section IV.

## Languages by Directory

| Directory | Language |
|-----------|----------|
| `frontend/` | JavaScript (React) |
| `backend/` | TBD (likely Python for Lambda) |
| `CustomerSupport/app/` | Python |
| `CustomerSupport/agentcore/cdk/` | TypeScript |
