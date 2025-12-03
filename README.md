# Elastic Agent Builder NBA Demo

An end-to-end NBA analysis sandbox that blends Elasticsearch, Elastic Agent Builder, multiple Model Context Protocol (MCP) services, and a modern Next.js interface. The latest iteration adds an experimental **Sentiment MCP Server** that surfaces real-time social buzz to complement the existing data pipelines.

## 🏗️ High-Level Architecture

- **Ingest**: Python scripts for data collection and Elasticsearch indexing
- **Backend**: Next.js API routes and business logic
- **Frontend**: Interactive web interface for commentary companion

![NBA Logo](/images/screenshotChatbot1.png)

### Detailed Component Breakdown

- **Ingest (`/ingest`)** – Python jobs that hydrate Elasticsearch with historical stats, player logs, and live scores.
- **MCP Aggregator (`/backend/mcp-aggregator`)** – Orchestrates Elastic Agent Builder, NBA/BallDontLie MCPs, and the new Sentiment MCP through static, LLM, and advanced routing layers.
- **Sentiment MCP (`/mcp-servers/sentiment`)** – Node MCP server that delivers Twitter, Reddit, narrative, and aggregated sentiment insights with safe fallbacks.
- **NBA Commentary Web (`/nba-commentary-web`)** – Next.js frontend + express websocket backend that surfaces the aggregator to end users.

```
┌─────────────────────────┐        ┌──────────────────────┐
│  NBA / Reddit / Twitter │  --->  │ Sentiment MCP Server │
└─────────────────────────┘        └──────────────────────┘
		  │                                   │
┌─────────────────────────┐        ┌──────────────────────┐
│ Elastic Agent Builder   │  --->  │   MCP Aggregator     │  --->  Web UI / API
└─────────────────────────┘        └──────────────────────┘
```

## ⚙️ Prerequisites

- Node.js 20+
- Python 3.10+ (for ingestion scripts)
- Access to an Elastic Cloud (or self-hosted) deployment with Agent Builder enabled
- Optional: API access for Twitter/X and Reddit if you want live sentiment

## 🚀 Quick Start

```bash
# 1. Install aggregator dependencies
cd backend/mcp-aggregator
npm install

# 2. Install sentiment MCP server deps
cd ../../mcp-servers/sentiment
npm install

# 3. Build TypeScript outputs
npm run build            # builds the sentiment MCP
cd ../../backend/mcp-aggregator
npm run build            # builds aggregator TypeScript

# 4. Install web app dependencies (optional UI)
cd ../../nba-commentary-web
npm install
```

## 🔐 Environment Variables

The project uses **43 environment variables** across all components for maximum configurability. All variables have sensible defaults for development.

### Quick Setup

Copy the example file and customize:
```bash
cp .env.local.example .env.local
# Edit .env.local with your actual credentials
```

### Critical Variables (Required for Production)

```bash
# Elastic / Kibana
ELASTICSEARCH_URL=https://your-elastic.es.cloud
ELASTICSEARCH_API_KEY=<elastic-api-key>
KIBANA_URL=https://your-kibana.elastic.cloud
AGENT_ID=nba_commentary_assitante

# Frontend WebSocket (CRITICAL - must match deployed backend)
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Anthropic Claude API
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# Azure OpenAI (for a2a-backend)
AZURE_OPENAI_API_KEY=<azure-openai-key>
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=<deployment-name>
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Elastic Agent Builder A2A Protocol
ELASTIC_STATS_AGENT_URL=https://your-kibana.elastic.co/api/agent_builder/agents/stats-agent-id/converse
ELASTIC_MEDIA_AGENT_URL=https://your-kibana.elastic.co/api/agent_builder/agents/media-agent-id/converse
ELASTIC_API_KEY=<elastic-api-key>
```

### Feature Flags

```bash
USE_NBA_MCP_SERVER=true          # switch between NBA Python server and BallDontLie MCP
USE_LLM_ROUTER=true              # enable Claude-powered classic router
USE_LLM_ADVANCED_ROUTER=false    # enable experimental advanced router
USE_SENTIMENT_MCP_SERVER=true    # turns on the sentiment MCP client + routing rules
```

### Optional Variables

For sentiment analysis, NBA data enhancements, and performance tuning, see the complete list in `.env.local.example` which documents all 43 variables organized by component with priority levels (CRITICAL/HIGH/MEDIUM/LOW).

## 🛠️ Running the Stack

1. **Sentiment MCP Server** (stdio worker)
	```bash
	cd mcp-servers/sentiment
	npm run build
	npm start
	```

2. **MCP Aggregator**
	```bash
	cd backend/mcp-aggregator
	npm run build
	npm start
	```

3. **Web Experience (optional)**
	```bash
	cd nba-commentary-web
	npm run dev    # Next.js on http://localhost:3000
	```

		- Sentiment tester UI: http://localhost:3000/sentiment-test (dedicated tooling surface for Twitter/Reddit checks)


## 🧠 Sentiment MCP Cheat Sheet

| Tool Name                | Purpose                                              |
|--------------------------|------------------------------------------------------|
| `get_twitter_player_sentiment`   | Uses Twitter/X samples (with automatic fallbacks)        |
| `get_reddit_player_sentiment`    | Reddit discussion pulses with optional subreddit focus   |
| `get_combined_player_sentiment`  | Weighted blend of chosen sources with breakdown details  |
| `analyze_player_narrative_trend` | Lightweight narrative + momentum trend synthesizer       |
| `detect_narrative_shift`         | Flags sudden shifts against the 7-day baseline           |
| `compare_players_sentiment`      | Side-by-side comparison of combined sentiment profiles   |

All tools survive missing credentials by generating annotated fallback responses, making it safe to keep the feature flag on in development.

> Tip: hit the `/sentiment-test` route while the Next.js dev server is running for a purpose-built dashboard that exercises each sentiment tool individually and confirms Twitter/Reddit connectivity.

## 🧪 Testing

### Aggregator (Node, tsx)

```bash
cd backend/mcp-aggregator
npx tsx tests/parser.test.ts
npx tsx tests/tool-metadata.test.ts
npx tsx tests/advanced-router.test.ts
npx tsx tests/advanced-router-chaos.test.ts
```

### Sentiment MCP (Vitest)

```bash
cd mcp-servers/sentiment
npm run test
```

Running all of the above is also captured under the "Run builds and regression tests" checklist in this project plan.

## 🧾 Feature Flags Reference

- `USE_NBA_MCP_SERVER`: Switch between the Python NBA MCP and the TypeScript BallDontLie MCP.
- `USE_LLM_ROUTER`: Enables the Claude Sonnet 4.5 assisted router (metadata-aware).
- `USE_LLM_ADVANCED_ROUTER`: Enables scratchpad execution + guardrails (requires Anthropic key).
- `USE_SENTIMENT_MCP_SERVER`: Activates sentiment tooling, updates routing plans, and exposes telemetry tags.
- `TWITTER_SENTIMENT_SERVICE`: When set to `false`, disables Twitter sentiment data and relies only on Reddit (default: `true`).

## 🩺 Health & Telemetry

The aggregator continues to emit structured logs through `routerMetrics`. Look for entries like:

```
[RouterMetrics] plan {
  router: 'advanced',
  intent: 'SENTIMENT',
	tools: ['sentiment:get_combined_player_sentiment', 'sentiment:analyze_player_narrative_trend'],
  warnings: [],
  source: 'fallback',
  executed: true,
  usedFallback: false
}
```

Use `GET /api/mcp/health` (Next.js API) to verify cache stats and connection state for Elastic, NBA/BallDontLie, and the sentiment server.

## 🧰 Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Sentiment MCP connection failed` | Flag enabled but server not built/running | `cd mcp-servers/sentiment && npm run build && npm start` |
| Sentiment tools tagged as `degraded` | Missing social API credentials | Provide Twitter/Reddit tokens or accept fallback behaviour |
| `Tool ... not available` guardrail warning | Router planned tool not in tool map | Re-run aggregator init after server rebuild (`clearCache`, restart) |
| Scratchpad execution errors | Advanced router experimental mode without Anthropic key | Disable `USE_LLM_ADVANCED_ROUTER` or set `ANTHROPIC_API_KEY` |

## 📁 Project Structure

```
Elastic-Agent-Builder-NBA-Demo/
├── backend/
│   └── mcp-aggregator/          # Multi-MCP orchestration layer
│       ├── src/
│       │   ├── index.ts         # Main aggregator with caching
│       │   ├── router.ts        # Static query routing
│       │   ├── llm-router.ts    # Claude-powered routing
│       │   ├── llm-advanced-router.ts  # Experimental scratchpad router
│       │   ├── servers/         # MCP client implementations
│       │   └── code-execution/  # Sandboxed code execution
│       └── tests/               # Unit tests
│
├── mcp-servers/
│   ├── balldontlie/             # BallDontLie NBA API MCP server
│   ├── sentiment/               # Twitter/Reddit sentiment MCP server
│   └── nba-mcp-server/          # Python NBA MCP server (legacy)
│
├── nba-commentary-web/          # Next.js frontend
│   ├── app/                     # Next.js 13+ app directory
│   ├── components/              # React components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utility functions
│   ├── pages/                   # API routes and special pages
│   │   ├── api/mcp/             # MCP aggregator API endpoints
│   │   ├── sentiment-test.tsx   # Sentiment testing UI
│   │   └── statsandbuzz/        # Stats & Buzz feature
│   └── nba-backend/             # Express WebSocket server
│
├── data/ingest/                 # Python data ingestion scripts
│   ├── create_indexes.py        # Elasticsearch index creation
│   ├── ingest_player_stats.py   # Season statistics ingestion
│   ├── ingest_game_logs.py      # Game-by-game logs ingestion
│   ├── ingest_game_schedule.py  # Schedule data ingestion
│   └── stream_live_games.py     # Real-time game score streaming
│
├── a2a-backend/                 # Python FastAPI agent-to-agent backend
│   └── supervisor.py            # Multi-agent orchestration
│
└── .env.local.example           # Complete environment variable reference
```

## ✨ Features

### Stats & Buzz

Interactive multi-server query interface combining real-time data with sentiment analysis:

- **Location:** `/statsandbuzz/chat`
- **Features:**
  - Natural language queries across Elasticsearch, BallDontLie, and Sentiment MCPs
  - Intelligent LLM-powered routing to appropriate data sources
  - Real-time sentiment analysis from Twitter and Reddit
  - Cached responses for improved performance
  - Query history and context preservation

**Quick Actions:**
- Hot players analysis (form, efficiency, team distribution)
- Game schedules and live scores
- Player comparisons with career stage context
- Playoff race predictions
- Team performance statistics
- Game previews with commentary

### MCP Aggregator

Unified query interface across multiple Model Context Protocol servers:

- **Elastic MCP:** Elasticsearch queries via Agent Builder
- **BallDontLie MCP:** Live NBA data and current season rosters
- **Sentiment MCP:** Social media buzz and narrative analysis
- **NBA MCP:** Legacy Python server support

**Routing Modes:**
1. **Static Router:** Keyword-based routing (fastest)
2. **LLM Router:** Claude Sonnet 4.5 semantic routing (recommended)
3. **Advanced Router:** Experimental scratchpad with code execution

### Data Ingestion Pipeline

Automated NBA data collection and indexing:

- **Player Statistics:** Season averages for tracked players
- **Game Logs:** Individual game performance history
- **Live Games:** Real-time score updates (30s intervals)
- **Game Schedule:** Season schedule with team matchups

**Tracked Players:** LeBron James, Nikola Jokic, Stephen Curry, Luka Doncic, Shai Gilgeous-Alexander, Jayson Tatum, Anthony Edwards, LaMelo Ball, Giannis Antetokounmpo, Joel Embiid

## 🚢 Deployment

### Production Checklist

**Required Configuration:**
1. Set all CRITICAL environment variables in `.env.local`
2. Update `NEXT_PUBLIC_WS_URL` to match deployed backend URL
3. Configure Azure OpenAI credentials for a2a-backend
4. Set Elastic Agent Builder A2A protocol endpoints
5. Build all TypeScript services (`npm run build`)
6. Verify Elasticsearch indexes are created

**Annual Maintenance:**
- Update `NBA_CURRENT_SEASON` at the start of each NBA season (e.g., "2025-26")

**Optional Enhancements:**
- Configure Twitter and Reddit API credentials for live sentiment
- Set BallDontLie API key for enhanced NBA data
- Tune cache settings (`MCP_CACHE_MAX_SIZE`, `MCP_CACHE_TTL_MS`)
- Adjust bulk indexing chunk sizes for your Elasticsearch cluster

### Build Commands

```bash
# Backend services
cd backend/mcp-aggregator && npm run build
cd mcp-servers/balldontlie && npm run build
cd mcp-servers/sentiment && npm run build

# Frontend
cd nba-commentary-web && npm run build

# Verify builds
npm run lint  # Check for linting errors
npm test      # Run test suites
```

### Environment-Specific Settings

**Development:**
- Use localhost URLs for all services
- Enable debug logging (`LOG_LEVEL=debug`)
- Disable production optimizations

**Production:**
- Use production URLs and API keys
- Enable caching for optimal performance
- Set appropriate timeouts for your infrastructure
- Use production-grade Elasticsearch cluster
- Enable monitoring and telemetry

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code style guidelines
- Development workflow
- Pull request process
- Testing requirements

## 🆘 Support

- **Issues:** File bugs and feature requests on GitHub Issues
- **Troubleshooting:** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- **Architecture:** Review [ARCHITECTURE_LLM_SUMMARY.md](./ARCHITECTURE_LLM_SUMMARY.md) for system design

---

Enjoy exploring the combined Elastic + MCP + sentiment experience! Contributions that plug in additional MCPs or real API integrations are very welcome.
