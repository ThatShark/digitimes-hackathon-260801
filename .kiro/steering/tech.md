# Tech Stack & Build System

## Frontend

- **Framework**: React + Vite (JavaScript)
- **Charting**: lightweight-charts (K-line / candlestick)
- **Location**: `frontend/src/`
- **Status**: Scaffolding stage

## Backend (AWS Lambda)

- **Runtime**: AWS Lambda + API Gateway
- **Language**: Python (planned)
- **Location**: `backend/src/`
- **Status**: Scaffolding stage
- **Responsibilities**: S3 read/write, MAX API proxy, CoinMarketCap API, trade execution via MAX Skill

## AI Agent (AgentCore)

- **Framework**: AWS Bedrock AgentCore + Strands Agents SDK
- **Language**: Python 3.14 (CodeZip build)
- **Location**: `CustomerSupport/app/CustomerSupport/`
- **Package manager**: uv (uses `pyproject.toml` + `uv.lock`)
- **Key dependencies**:
  - `strands-agents >= 1.15.0`
  - `bedrock-agentcore >= 1.9.1`
  - `mcp >= 1.19.0`
  - `aws-opentelemetry-distro`
  - `botocore[crt] >= 1.35.0`
- **MCP Client**: Streamable HTTP (currently connected to Exa AI for web search)

## CDK Infrastructure

- **Location**: `CustomerSupport/agentcore/cdk/`
- **Language**: TypeScript
- **CDK version**: 2.1126.0
- **Key constructs**: `@aws/agentcore-cdk`
- **Package manager**: npm

## Cloud Services (AWS)

| Service | Purpose |
|---------|---------|
| AWS Lambda | Serverless compute (backend APIs) |
| AWS API Gateway | REST API routing for frontend |
| AWS S3 | CSV storage, personality data, chat history |
| AWS Bedrock (Claude) | LLM reasoning — personality analysis, market analysis, conversational trading |
| AWS CDK | Infrastructure as code |
| AWS AgentCore | Agent runtime + deployment |

## External APIs

| API | Purpose | Auth |
|-----|---------|------|
| MAX Exchange API (v3) | Real-time pricing, K-line, depth, orders | API Key (Private API for Lv2) |
| MAX MCP Server | MCP-compatible MAX integration | — |
| MAX Skill | Trade execution module | — |
| CoinMarketCap | Fear & Greed Index | API Key |

## Common Commands

### AgentCore Agent (Python)

```bash
# Run agent locally with hot-reload
agentcore dev

# Deploy to AWS
agentcore deploy

# Validate configuration
agentcore validate

# Invoke agent (local or deployed)
agentcore invoke

# View logs / traces
agentcore logs
agentcore traces list
```

### CDK Infrastructure

```bash
cd CustomerSupport/agentcore/cdk
npm install
npm run build          # TypeScript compile
npm test               # Jest tests
npx cdk synth          # Synthesize CloudFormation
npx cdk deploy         # Deploy stack
```

### Frontend (planned)

```bash
cd frontend
npm install
npm run dev            # Vite dev server
npm run build          # Production build
```

### Python Agent Dependencies

```bash
cd CustomerSupport/app/CustomerSupport
uv sync                # Install dependencies from uv.lock
uv add <package>       # Add new dependency
```

## Key Reference Docs

- MAX API: https://max-api.maicoin.com/doc/v3.html
- MAX MCP Server: https://github.com/bistin/max-mcp-server
- MAX Skill: https://github.com/bistin/max-api-skill
- CoinMarketCap API: https://pro.coinmarketcap.com/api/documentation/
- AgentCore CLI: https://github.com/aws/agentcore-cli
- AgentCore CDK: https://github.com/aws/agentcore-l3-cdk-constructs
