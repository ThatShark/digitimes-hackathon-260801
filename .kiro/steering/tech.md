# Tech Stack & Build System

## Frontend

- **Framework**: React + Vite (JavaScript)
- **Charting**: lightweight-charts (K-line / candlestick)
- **Location**: `frontend/src/`
- **Status**: Scaffolding stage (placeholder tmpfile only)

## Backend (AWS Lambda)

- **Runtime**: AWS Lambda + API Gateway
- **Location**: `backend/src/`
- **Status**: Scaffolding stage

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

## CDK Infrastructure

- **Location**: `CustomerSupport/agentcore/cdk/`
- **Language**: TypeScript
- **CDK version**: 2.1126.0
- **Key constructs**: `@aws/agentcore-cdk`
- **Package manager**: npm

## Common Commands

### AgentCore Agent (Python)

```bash
# Run agent locally with hot-reload
agentcore dev

# Deploy to AWS
agentcore deploy

# Validate configuration
agentcore validate

# Invoke agent
agentcore invoke
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

## Cloud Services

- AWS Lambda (serverless compute)
- AWS API Gateway (REST API routing)
- AWS S3 (CSV storage, personality data)
- AWS Bedrock (Claude LLM)
- AWS CDK (infrastructure as code)
