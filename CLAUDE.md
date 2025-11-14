# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A real-time NBA game analysis and commentary system using Elasticsearch, Elastic Agent Builder, and the NBA API. The system ingests NBA game data, player statistics, and live game updates into Elasticsearch, then provides an interactive web interface for AI-powered commentary through Elastic Agent Builder.

## Architecture

The project consists of three main components:

### 1. Data Ingestion (`/ingest`)
Python scripts that collect NBA data and index it into Elasticsearch:
- `create_indexes.py` - Creates three Elasticsearch indexes with proper mappings
- `ingest_player_stats.py` - Ingests season statistics for tracked players
- `ingest_game_logs.py` - Ingests individual game performance logs
- `stream_live_games.py` - Fetches and indexes live game scores in real-time

**Key indexes:**
- `nba-player-stats` - Season averages (PPG, APG, RPG, shooting percentages)
- `nba-player-game-logs` - Individual game performances with detailed stats
- `nba-live-games` - Real-time game scores and status updates

### 2. Backend (`/nba-commentary-web/nba-backend`)
Node.js/Express WebSocket server that:
- Connects to Kibana Agent Builder via REST API
- Maintains conversation context across multiple queries
- Streams AI responses word-by-word to the frontend for better UX
- Handles real-time bidirectional communication with the web client

**Important details:**
- Uses WebSocket for real-time communication (port 3001)
- Calls `/api/agent_builder/converse` endpoint in Kibana
- Requires `KIBANA_URL`, `ELASTICSEARCH_API_KEY`, and `AGENT_ID` environment variables
- Implements conversation persistence via `conversation_id`

### 3. Frontend (`/nba-commentary-web`)
Next.js application with React components:
- Modern chat interface for NBA commentary queries
- Real-time streaming of AI responses
- Built with TypeScript, Tailwind CSS, and shadcn/ui patterns
- Uses custom hook (`useChat.ts`) for WebSocket connection management

### 4. Sentiment MCP Server (`/mcp-servers/sentiment`)
- TypeScript MCP server that surfaces Twitter, Reddit, narrative, and aggregated sentiment tools
- Resilient fallback behaviour when social credentials are absent
- Shared sentiment analysis engine (`analysis/sentiment-engine.ts`) plus deterministic mock data for offline mode

## Development Commands

### Python Data Ingestion

```bash
# Setup Python environment
cd ingest
pip install -r requirements.txt

# Create Elasticsearch indexes (run first)
python create_indexes.py

# Ingest player statistics
python ingest_player_stats.py

# Ingest game logs
python ingest_game_logs.py

# Stream live games (runs continuously)
python stream_live_games.py
```

### Backend WebSocket Server

```bash
cd nba-commentary-web/nba-backend

# Install dependencies
npm install

# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### Next.js Frontend

```bash
cd nba-commentary-web

# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build
npm start

# Lint code
npm run lint
```

## Environment Configuration

Create a `.env` file in the `/ingest` directory:
```bash
ELASTICSEARCH_URL=https://your-cluster.es.cloud
ELASTICSEARCH_API_KEY=your-api-key
```

Create a `.env` file in `/nba-commentary-web/nba-backend`:
```bash
KIBANA_URL=https://your-kibana.elastic.co
ELASTICSEARCH_API_KEY=your-api-key
AGENT_ID=nba_commentary_assitante
PORT=3001
```

## Key Technical Patterns

### WebSocket Streaming Flow
The backend implements word-by-word streaming:
1. Client sends query via WebSocket
2. Backend sends status update
3. Backend calls Elastic Agent Builder
4. Response is split into words and streamed with 20ms delay
5. Final complete message includes tools used and metadata

### Tracked Players
The system tracks 10 prominent NBA players (defined in `ingest_game_logs.py:17`):
- LeBron James, Nikola Jokic, Stephen Curry, Luka Doncic, etc.

### Data Flow
1. NBA API → Python ingestion scripts → Elasticsearch indexes
2. User query → WebSocket → Backend → Elastic Agent Builder
3. Agent Builder queries Elasticsearch → Returns insights → Streamed to frontend

## Important Implementation Notes

- **Rate Limiting:** NBA API requires 0.6s delay between requests (see `ingest_game_logs.py:56`)
- **Date Parsing:** NBA API returns dates in "Apr 11, 2025" format, must be converted to ISO 8601 for Elasticsearch
- **Minutes Field:** Player minutes come as "MM:SS" strings and must be converted to decimal floats
- **Conversation Context:** Backend maintains `conversationId` per WebSocket connection for multi-turn conversations
- **Error Handling:** All ingestion scripts use try-catch with fallback values to handle missing data

## Testing

To test the full system:

1. Start the backend: `cd nba-commentary-web/nba-backend && npm run dev`
2. Start the frontend: `cd nba-commentary-web && npm run dev`
3. Visit http://localhost:3000
4. Try queries like:
   - "How did LeBron James perform last game?"
   - "What are the live scores today?"
   - "Compare Stephen Curry and Luka Doncic this season"

## MCP Aggregator (`/backend/mcp-aggregator` & `/mcp-servers/balldontlie`)

The MCP Aggregator is a sophisticated orchestration layer that combines multiple Model Context Protocol (MCP) servers to provide unified NBA data access.

### Architecture Components

**1. BallDontLie MCP Server (`/mcp-servers/balldontlie`)**
- Standalone MCP server that wraps the BallDontLie NBA API
- Provides 4 MCP tools:
  - `nba_get_players` - Search players by name
  - `nba_get_player_stats` - Get season averages
  - `nba_get_games` - Get games by date/team
  - `nba_get_teams` - Get all NBA teams
- Built with TypeScript and MCP SDK
- Communicates via stdio transport

**2. MCP Aggregator (`/backend/mcp-aggregator`)**
Core components:
- `types.ts` - TypeScript type definitions for the entire system
- `router.ts` - Query intent classification and tool planning
- `cache.ts` - LRU cache with TTL for tool results
- `servers/elastic-client.ts` - Connects to Kibana Agent Builder via HTTP-based MCP using `mcp-remote`
- `servers/balldontlie-client.ts` - Connects to BallDontLie MCP server via stdio
- `servers/sentiment-client.ts` - Launches the sentiment MCP server and keeps tool inventory in sync
- `tool-metadata.ts` - Normalises tool metadata, labels, and derived tags for LLM prompts
- `llm-router.ts` - Claude Sonnet 4.5 powered planner with metadata-aware prompts
- `llm-advanced-router.ts` - Experimental scratchpad + guardrail router with code execution sandbox
- `code-execution/executor.ts` - Secure VM harness used by advanced router scratchpads
- `router-metrics.ts` - Structured telemetry emission for every routing decision
- `index.ts` - Main aggregator class (singleton pattern)

**Important:** The Elastic connection uses `mcp-remote` to connect to `{KIBANA_URL}/api/agent_builder/mcp` with API key authentication.

**3. Next.js API Routes**
- `/api/mcp/query` - Executes queries through the aggregator
- `/api/mcp/health` - Health check with server status and cache stats
- `/test` - Interactive test page for the aggregator

### Development Commands

```bash
# Build BallDontLie MCP Server
cd mcp-servers/balldontlie
npm install
npm run build

# Build Sentiment MCP Server
cd ../sentiment
npm install
npm run build
npm run test

# Build MCP Aggregator
cd backend/mcp-aggregator
npm install
npm run build

# Test the aggregator (requires .env.local)
npm test

# Run Next.js with MCP support
cd nba-commentary-web
npm run dev
# Visit http://localhost:3000/test
```

### Environment Variables

Add to `.env.local` in project root:
```bash
# Elasticsearch & Kibana
ELASTICSEARCH_URL=https://your-cluster.elastic.co
ELASTICSEARCH_API_KEY=your-api-key
KIBANA_URL=https://your-kibana.elastic.co
AGENT_ID=nba_commentary_assitante

# BallDontLie API
BALLDONTLIE_API_KEY=your-balldontlie-api-key

# Sentiment MCP (optional but recommended)
USE_SENTIMENT_MCP_SERVER=true
TWITTER_BEARER_TOKEN=your-twitter-token
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
REDDIT_USERNAME=your-reddit-username
REDDIT_PASSWORD=your-reddit-password
REDDIT_APP_NAME=your-reddit-app-name
SENTIMENT_WINDOW_MINUTES=180
SENTIMENT_MAX_SAMPLES=50
```

### Intelligent Query Routing

The router uses **semantic-first routing** that prioritizes Elasticsearch for natural language understanding:

#### Routing Strategy

**Elasticsearch (PRIMARY)** - Used for:
- Natural language queries (semantic search via `platform.core.search`)
- Analytics and trend analysis
- Historical data and career statistics
- Comparisons and insights
- Any query that doesn't explicitly request real-time data

**BallDontLie (REAL-TIME ONLY)** - Used for:
- Live game data (keywords: live, today, tonight, current, now)
- Current season rosters
- Real-time scores and game status

#### Query Examples

| Query | Primary Tool | Reason |
|-------|-------------|---------|
| "LeBron James stats" | `elastic:platform.core.search` | Natural language, semantic understanding |
| "Analyze shooting trends" | `elastic:platform.core.search` | Analytics query |
| "What games are live today?" | `balldontlie:nba_get_games` | Real-time data requested |
| "Compare Curry and Doncic" | `elastic:platform.core.search` | Analytical comparison |
| "Current team roster" | Both | Elasticsearch + BallDontLie for real-time |

#### Real-Time Detection

The router detects real-time data requests using keywords:
- `live`, `today`, `tonight`, `current`, `now`, `ongoing`, `right now`

When these keywords are present, BallDontLie is added to provide fresh data.

#### Tool Parameter Validation

All tool parameters are validated against the tool's schema before execution. The router only calls tools when it has the required parameters:

**Example: `get_player_career_stats`**
- Required: `player_id` (number), `season_type` (string)
- The router will NOT call this tool without both parameters
- Use filters to provide structured data when needed

### Caching Strategy

- **Type:** LRU (Least Recently Used)
- **Size:** 500 entries max
- **TTL:** 5 minutes
- **Key Format:** `serverId:toolName:params-hash`
- Cache stats available via `/api/mcp/health`

### Testing the Aggregator

**Command Line:**
```bash
cd backend/mcp-aggregator
npm test
```

**Web Interface:**
1. Start Next.js: `cd nba-commentary-web && npm run dev`
2. Visit http://localhost:3000/test
3. Click "Check Health" to verify server connections
4. Try example queries or write custom ones

**API Testing:**
```bash
# Query endpoint
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Find player LeBron James"}'

# Health check
curl http://localhost:3000/api/mcp/health
```
