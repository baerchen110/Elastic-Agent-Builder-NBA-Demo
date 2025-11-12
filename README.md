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

Create (or extend) a `.env.local` at the repo root or export the variables before running any MCP services.

```bash
# Elastic / Kibana
ELASTICSEARCH_URL=https://your-elastic.es.cloud
ELASTICSEARCH_API_KEY=<elastic-api-key>
KIBANA_URL=https://your-kibana.elastic.cloud

# MCP Feature Flags
USE_NBA_MCP_SERVER=true          # switch between NBA Python server and BallDontLie MCP
USE_LLM_ROUTER=true              # enable Claude-powered classic router
USE_LLM_ADVANCED_ROUTER=false    # enable experimental advanced router
USE_SENTIMENT_MCP_SERVER=true    # turns on the sentiment MCP client + routing rules

# Sentiment MCP tokens (optional but recommended)
TWITTER_SENTIMENT_SERVICE=true   # set to false to disable Twitter and use Reddit only
TWITTER_BEARER_TOKEN=<twitter-token>
REDDIT_CLIENT_ID=<reddit-client-id>
REDDIT_CLIENT_SECRET=<reddit-client-secret>
REDDIT_USERNAME=<reddit-username>
REDDIT_PASSWORD=<reddit-password>
REDDIT_APP_NAME=<reddit-app-name>
SENTIMENT_WINDOW_MINUTES=180     # default lookback window
SENTIMENT_MAX_SAMPLES=50         # per-source sample cap

# BallDontLie (fallback server)
BALLDONTLIE_API_KEY=<balldontlie-token>
```

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

---

Enjoy exploring the combined Elastic + MCP + sentiment experience! Contributions that plug in additional MCPs or real API integrations are very welcome.
