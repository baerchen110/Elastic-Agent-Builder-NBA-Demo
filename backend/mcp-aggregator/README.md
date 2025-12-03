# MCP Aggregator

A sophisticated orchestration layer that unifies multiple Model Context Protocol (MCP) servers to provide intelligent, context-aware NBA data access and analysis.

## Overview

The MCP Aggregator acts as a central intelligence hub that:
- Connects to multiple MCP servers (Elasticsearch/Kibana Agent Builder, BallDontLie NBA API, Sentiment Analysis)
- Intelligently routes queries to the most appropriate data sources
- Provides caching for improved performance
- Offers multiple routing strategies from simple keyword matching to advanced LLM-powered planning
- Maintains tool metadata for semantic understanding and routing decisions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Aggregator Core                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Router    │  │    Cache     │  │   Tool Metadata      │  │
│  │  - Static    │  │  LRU + TTL   │  │  - Normalization     │  │
│  │  - LLM       │  │  500 entries │  │  - Tags & Labels     │  │
│  │  - Advanced  │  │  5 min TTL   │  │  - Semantic Search   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐
  │ Elastic Client │  │ BallDontLie    │  │ Sentiment Client   │
  │ (HTTP MCP)     │  │ (stdio MCP)    │  │ (stdio MCP)        │
  └────────────────┘  └────────────────┘  └────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐
  │ Kibana Agent   │  │ BallDontLie    │  │ Twitter/Reddit     │
  │ Builder        │  │ NBA API        │  │ Sentiment API      │
  └────────────────┘  └────────────────┘  └────────────────────┘
```

## Core Components

### 1. Router System (`src/router.ts`, `src/llm-router.ts`, `src/llm-advanced-router.ts`)

The aggregator provides three routing strategies:

#### Static Router (`router.ts`)
**Purpose:** Fast, keyword-based routing for predictable queries

**How it works:**
- Analyzes query text for specific keywords (e.g., "sentiment", "live", "today")
- Maps keywords to specific tools
- Fallback to Elasticsearch for general queries

**Best for:**
- Simple, predictable queries
- Low-latency requirements
- Queries with clear intent signals

**Example:**
```typescript
// Query: "What are the live scores today?"
// Detected keywords: "live", "today"
// Routes to: balldontlie:nba_get_games
```

#### LLM Router (`llm-router.ts`)
**Purpose:** Claude Sonnet 4.5-powered semantic understanding of queries (Recommended)

**How it works:**
1. Receives query and available tool metadata
2. Sends to Claude with context about tool capabilities
3. Claude analyzes intent and returns structured routing plan
4. Executes planned tools in sequence

**Best for:**
- Natural language queries
- Complex analytical requests
- Queries requiring semantic understanding
- Production use cases

**Example:**
```typescript
// Query: "Analyze LeBron's shooting trends this season"
// Claude identifies: Analytics query requiring historical data
// Routes to: elastic:platform.core.search (semantic search)
// Returns: Comprehensive analysis with shooting percentages over time
```

**Configuration:**
```bash
# Enable in .env.local
USE_LLM_ROUTER=true
ANTHROPIC_API_KEY=your-api-key
```

#### Advanced Router (`llm-advanced-router.ts`)
**Purpose:** Experimental router with scratchpad reasoning and code execution (EXPERIMENTAL)

**How it works:**
1. Claude creates a reasoning scratchpad
2. Can execute JavaScript code in sandboxed VM for calculations
3. Applies guardrails to validate tool availability
4. Self-corrects execution plan based on results

**Best for:**
- Research and experimentation
- Complex multi-step reasoning
- Queries requiring intermediate calculations

**Security:**
- Code execution runs in isolated VM (vm2)
- Timeout protection (5 seconds)
- No file system or network access
- Read-only access to tool metadata

**Example:**
```typescript
// Query: "Calculate average sentiment for top 5 scorers"
// Scratchpad:
//   1. Get top scorers from Elasticsearch
//   2. For each player, get sentiment
//   3. Calculate average using code execution
// Executes: Multiple tools + JavaScript calculation
```

**Configuration:**
```bash
# Enable in .env.local
USE_LLM_ADVANCED_ROUTER=true
ANTHROPIC_API_KEY=your-api-key
```

### 2. MCP Clients (`src/servers/`)

#### Elastic Client (`elastic-client.ts`)
**Connection:** HTTP-based MCP using `mcp-remote`
**Endpoint:** `{KIBANA_URL}/api/agent_builder/mcp`
**Authentication:** API key via `x-elastic-api-key` header

**Available Tools:**
- `platform.core.search` - Semantic search over Elasticsearch indexes
- `platform.core.get_index_info` - Index metadata and mappings
- Custom agent builder tools (configurable per deployment)

**Why HTTP MCP?**
- Kibana Agent Builder exposes MCP over HTTP
- Allows remote access to Elasticsearch capabilities
- Integrates with Agent Builder's conversational AI

**Configuration:**
```bash
KIBANA_URL=https://your-kibana.elastic.co
ELASTICSEARCH_API_KEY=your-api-key
```

#### BallDontLie Client (`balldontlie-client.ts`)
**Connection:** stdio (standard input/output)
**Server Path:** `../../mcp-servers/balldontlie/dist/index.js`

**Available Tools:**
- `nba_get_players` - Search players by name
- `nba_get_player_stats` - Get season averages for a player
- `nba_get_games` - Get games by date range or team
- `nba_get_teams` - Get all NBA teams

**Why stdio?**
- Lightweight process communication
- Standard MCP pattern for local servers
- Easy debugging via logs

**When Used:**
- Real-time data requests (live scores, today's games)
- Current season rosters
- Quick player lookups
- Queries with keywords: "live", "today", "current", "now"

**Configuration:**
```bash
BALLDONTLIE_API_KEY=your-api-key  # Optional but recommended
USE_NBA_MCP_SERVER=false  # Use BallDontLie instead of legacy NBA server
```

#### Sentiment Client (`sentiment-client.ts`)
**Connection:** stdio
**Server Path:** `../../mcp-servers/sentiment/dist/index.js`

**Available Tools:**
- `get_twitter_player_sentiment` - Twitter/X sentiment analysis
- `get_reddit_player_sentiment` - Reddit discussion analysis
- `get_combined_player_sentiment` - Weighted multi-source sentiment
- `analyze_player_narrative_trend` - Narrative momentum tracking
- `detect_narrative_shift` - Sudden sentiment shift detection
- `compare_players_sentiment` - Side-by-side sentiment comparison

**Fallback Behavior:**
- Works without social media API credentials
- Generates annotated mock data when credentials missing
- Marks responses as "degraded" for transparency

**Configuration:**
```bash
USE_SENTIMENT_MCP_SERVER=true
TWITTER_BEARER_TOKEN=your-token  # Optional
REDDIT_CLIENT_ID=your-client-id  # Optional
REDDIT_CLIENT_SECRET=your-secret  # Optional
```

### 3. Cache System (`src/cache.ts`)

**Purpose:** Reduce redundant API calls and improve response times

**Implementation:** LRU (Least Recently Used) cache with TTL (Time To Live)

**Configuration:**
```bash
MCP_CACHE_MAX_SIZE=500  # Maximum entries
MCP_CACHE_TTL_MS=300000  # 5 minutes (300,000ms)
```

**Cache Key Format:**
```
{serverId}:{toolName}:{params-hash}

Example:
balldontlie:nba_get_player_stats:sha256({"player_id":"237","season":"2024-25"})
```

**Cache Behavior:**
- Hit: Return cached result immediately
- Miss: Execute tool, cache result, return
- Eviction: LRU when max size reached, TTL expiration

**Bypass Cache:**
```typescript
// Force fresh data
const result = await aggregator.executeQuery({
  query: "Get LeBron stats",
  bypassCache: true
});
```

**Cache Stats:**
Available via `/api/mcp/health` endpoint:
```json
{
  "cache": {
    "size": 42,
    "maxSize": 500,
    "hitRate": 0.73
  }
}
```

### 4. Tool Metadata System (`src/tool-metadata.ts`)

**Purpose:** Normalize and enrich tool definitions for intelligent routing

**What it does:**
1. **Normalizes** tool schemas from different MCP servers
2. **Generates labels** describing tool capabilities in natural language
3. **Extracts tags** for semantic matching (e.g., "real-time", "analytics", "sentiment")
4. **Provides context** to LLM routers for better decision making

**Example:**
```typescript
// Raw tool from BallDontLie MCP
{
  name: "nba_get_games",
  description: "Get NBA games",
  inputSchema: { ... }
}

// Enriched metadata
{
  serverId: "balldontlie",
  toolName: "nba_get_games",
  fullName: "balldontlie:nba_get_games",
  description: "Get NBA games",
  label: "Get real-time NBA game data by date or team",
  tags: ["real-time", "games", "scores", "schedule"],
  inputSchema: { ... }
}
```

**Benefits:**
- LLM routers receive rich context for better planning
- Semantic search over tool capabilities
- Automatic tag generation for new tools
- Consistent metadata across all MCP servers

### 5. Code Execution Sandbox (`src/code-execution/executor.ts`)

**Purpose:** Safely execute JavaScript code snippets in scratchpad reasoning (Advanced Router only)

**Security Model:**
- Isolated VM using `vm2` library
- No file system access
- No network access
- No process manipulation
- 5-second timeout
- Memory limits enforced

**Allowed Operations:**
- Math calculations
- Array/object manipulation
- String processing
- JSON parsing
- Pure functions only

**Example:**
```typescript
// Advanced router scratchpad might generate:
const code = `
  const playerScores = [28.5, 25.2, 30.1];
  const average = playerScores.reduce((a, b) => a + b) / playerScores.length;
  return average;
`;

// Executed safely in sandbox
const result = await executeCode(code); // Returns: 27.93
```

**Use Cases:**
- Aggregating data from multiple tool calls
- Intermediate calculations
- Data transformations
- Statistical analysis

### 6. Router Metrics (`src/router-metrics.ts`)

**Purpose:** Structured telemetry for every routing decision

**Emitted Data:**
```typescript
{
  router: 'llm' | 'advanced' | 'static',
  intent: 'STATS' | 'SENTIMENT' | 'LIVE_GAMES' | 'ANALYTICS',
  tools: ['elastic:platform.core.search'],
  warnings: [],
  source: 'llm' | 'fallback' | 'keywords',
  executed: true,
  usedFallback: false,
  executionTimeMs: 1250
}
```

**Benefits:**
- Debug routing decisions
- Track router performance
- Identify fallback patterns
- Optimize routing rules

**Usage:**
```typescript
import { RouterMetrics } from './router-metrics';

RouterMetrics.logPlan({
  router: 'llm',
  intent: 'ANALYTICS',
  tools: ['elastic:platform.core.search'],
  source: 'llm',
  executed: true
});
```

## Usage

### Basic Query Execution

```typescript
import { MCPAggregator } from './index';

const aggregator = MCPAggregator.getInstance();
await aggregator.initialize();

const result = await aggregator.executeQuery({
  query: "What are LeBron James' stats this season?"
});

console.log(result);
// {
//   success: true,
//   results: [{ tool: "elastic:platform.core.search", data: {...} }],
//   cache: { hit: false }
// }
```

### Health Check

```typescript
const health = await aggregator.healthCheck();
console.log(health);
// {
//   elastic: { connected: true, tools: 5 },
//   balldontlie: { connected: true, tools: 4 },
//   sentiment: { connected: true, tools: 6 },
//   cache: { size: 42, maxSize: 500 }
// }
```

### List Available Tools

```typescript
const tools = await aggregator.listTools();
console.log(tools);
// [
//   { serverId: "elastic", toolName: "platform.core.search", ... },
//   { serverId: "balldontlie", toolName: "nba_get_players", ... },
//   { serverId: "sentiment", toolName: "get_twitter_player_sentiment", ... }
// ]
```

### Execute Specific Tool

```typescript
const result = await aggregator.executeTool({
  serverId: 'balldontlie',
  toolName: 'nba_get_player_stats',
  params: {
    player_id: 237,
    season: '2024-25'
  }
});
```

### Bypass Cache

```typescript
const result = await aggregator.executeQuery({
  query: "Live scores",
  bypassCache: true  // Force fresh data
});
```

## Routing Examples

### Example 1: Natural Language Analytics

**Query:** "Analyze Stephen Curry's shooting efficiency trends"

**Static Router:**
- No specific keywords detected
- Falls back to `elastic:platform.core.search`

**LLM Router:**
1. Identifies intent: Historical analytics
2. Recognizes need for semantic search
3. Plans: `elastic:platform.core.search` with shooting-focused query
4. Executes and returns comprehensive trend analysis

**Result:** Best choice = LLM Router (understands analytical intent)

### Example 2: Real-Time Data

**Query:** "What games are live right now?"

**Static Router:**
- Detects keywords: "live", "right now"
- Routes to: `balldontlie:nba_get_games`
- Fast execution (no LLM call)

**LLM Router:**
- Identifies intent: Real-time games
- Plans: `balldontlie:nba_get_games`
- Additional LLM overhead

**Result:** Best choice = Static Router (faster for clear real-time intent)

### Example 3: Sentiment Analysis

**Query:** "How are fans feeling about the Lakers?"

**Static Router:**
- Detects keyword: "feeling" (sentiment-related)
- Routes to: `sentiment:get_combined_player_sentiment`

**LLM Router:**
- Identifies team-level sentiment query
- Plans: Multiple sentiment tools for Lakers players
- Aggregates results

**Result:** Best choice = LLM Router (better understanding of team-level request)

### Example 4: Complex Multi-Step

**Query:** "Compare sentiment of the top 3 scorers this season"

**Static Router:**
- Limited to single tool execution
- Cannot handle multi-step logic

**LLM Router:**
- Plans two steps:
  1. Get top scorers from Elasticsearch
  2. Get sentiment for each
- Executes sequentially

**Advanced Router:**
- Creates scratchpad:
  1. Query Elasticsearch for top scorers
  2. Loop through results
  3. Get sentiment for each
  4. Calculate average using code execution
- Self-corrects if tools unavailable

**Result:** Best choice = Advanced Router (handles complexity with reasoning)

## Configuration Reference

### Required Variables

```bash
# Elasticsearch/Kibana
KIBANA_URL=https://your-kibana.elastic.co
ELASTICSEARCH_API_KEY=your-api-key

# Enable at least one MCP server
USE_NBA_MCP_SERVER=false  # Use BallDontLie instead
```

### Optional Variables

```bash
# LLM Routing (Recommended)
USE_LLM_ROUTER=true
ANTHROPIC_API_KEY=your-anthropic-key

# Advanced Router (Experimental)
USE_LLM_ADVANCED_ROUTER=false

# BallDontLie API
BALLDONTLIE_API_KEY=your-api-key

# Sentiment Analysis
USE_SENTIMENT_MCP_SERVER=true
TWITTER_BEARER_TOKEN=your-token
REDDIT_CLIENT_ID=your-client-id
REDDIT_CLIENT_SECRET=your-secret

# Cache Configuration
MCP_CACHE_MAX_SIZE=500
MCP_CACHE_TTL_MS=300000

# Server Paths (auto-detected by default)
BALLDONTLIE_MCP_SERVER_PATH=../../mcp-servers/balldontlie/dist/index.js
SENTIMENT_MCP_SERVER_PATH=../../mcp-servers/sentiment/dist/index.js
NBA_MCP_SERVER_PATH=../../mcp-servers/nba-mcp-server/nba_server.py
```

## Testing

### Unit Tests

```bash
npm test
```

**Test Files:**
- `tests/parser.test.ts` - Query parsing
- `tests/tool-metadata.test.ts` - Metadata normalization
- `tests/advanced-router.test.ts` - Scratchpad execution
- `tests/advanced-router-chaos.test.ts` - Edge cases and error handling

### Integration Testing

```bash
# Start aggregator
npm run build
npm start

# In another terminal
npx tsx tests/integration.test.ts
```

### Manual Testing

```bash
# Test individual components
npx tsx -e "
  import { MCPAggregator } from './src/index';
  const agg = MCPAggregator.getInstance();
  await agg.initialize();
  const result = await agg.executeQuery({ query: 'LeBron stats' });
  console.log(result);
"
```

## Performance Optimization

### 1. Cache Tuning

**Increase cache size for more hits:**
```bash
MCP_CACHE_MAX_SIZE=1000  # Default: 500
```

**Adjust TTL based on data freshness needs:**
```bash
# Real-time sports data: shorter TTL
MCP_CACHE_TTL_MS=60000  # 1 minute

# Historical data: longer TTL
MCP_CACHE_TTL_MS=3600000  # 1 hour
```

### 2. Router Selection

**Choose router based on query patterns:**

- **High query volume, predictable patterns** → Static Router
- **Natural language, varied queries** → LLM Router
- **Complex reasoning required** → Advanced Router

### 3. Batch Queries

**Process multiple queries efficiently:**
```typescript
const results = await Promise.all([
  aggregator.executeQuery({ query: "Player A stats" }),
  aggregator.executeQuery({ query: "Player B stats" }),
  aggregator.executeQuery({ query: "Player C stats" })
]);
```

### 4. Tool Parameter Optimization

**Provide structured parameters when possible:**
```typescript
// Less efficient (requires LLM parsing)
await aggregator.executeQuery({
  query: "LeBron James stats for 2024-25 season"
});

// More efficient (direct tool call)
await aggregator.executeTool({
  serverId: 'balldontlie',
  toolName: 'nba_get_player_stats',
  params: { player_id: 237, season: '2024-25' }
});
```

## Troubleshooting

### "MCP server connection failed"

**Symptoms:**
- Error in logs: `[Elastic/BallDontLie/Sentiment MCP] Connection failed`
- Health check shows `connected: false`

**Solutions:**

1. **Verify server is built:**
   ```bash
   cd mcp-servers/balldontlie
   npm run build
   ls -la dist/index.js  # Should exist
   ```

2. **Check environment variables:**
   ```bash
   echo $KIBANA_URL
   echo $ELASTICSEARCH_API_KEY
   ```

3. **Test server directly:**
   ```bash
   cd mcp-servers/balldontlie
   node dist/index.js
   # Should start without errors
   ```

### "Tool not available" in routing warnings

**Symptoms:**
- Router plans a tool that doesn't execute
- Warning in logs: `Tool elastic:platform.core.search not available`

**Solutions:**

1. **Refresh tool inventory:**
   ```typescript
   await aggregator.initialize();  // Re-fetch tools
   ```

2. **Check server health:**
   ```bash
   curl http://localhost:3000/api/mcp/health
   ```

3. **Verify tool name:**
   ```typescript
   const tools = await aggregator.listTools();
   console.log(tools.map(t => t.fullName));
   ```

### High cache miss rate

**Symptoms:**
- Cache hit rate < 50% in health check
- Slow response times

**Solutions:**

1. **Increase cache size:**
   ```bash
   MCP_CACHE_MAX_SIZE=1000
   ```

2. **Normalize queries:**
   - "lebron stats" and "LeBron stats" create different cache keys
   - Consider query normalization before hashing

3. **Check TTL:**
   ```bash
   # If TTL too short, items expire before reuse
   MCP_CACHE_TTL_MS=600000  # 10 minutes
   ```

### LLM router timeout

**Symptoms:**
- Query takes >30 seconds
- Timeout error from Anthropic API

**Solutions:**

1. **Simplify tool metadata:**
   - Reduce number of available tools
   - Use static router for simple queries

2. **Disable advanced router:**
   ```bash
   USE_LLM_ADVANCED_ROUTER=false
   ```

3. **Add query timeout:**
   ```typescript
   const result = await Promise.race([
     aggregator.executeQuery({ query }),
     new Promise((_, reject) =>
       setTimeout(() => reject(new Error('Timeout')), 10000)
     )
   ]);
   ```

## API Integration

### Next.js API Route (`/api/mcp/query`)

```typescript
// pages/api/mcp/query.ts
import { MCPAggregator } from '@/backend/mcp-aggregator';

export default async function handler(req, res) {
  const { query } = req.body;

  const aggregator = MCPAggregator.getInstance();
  await aggregator.initialize();

  const result = await aggregator.executeQuery({ query });

  res.json(result);
}
```

### Health Endpoint (`/api/mcp/health`)

```typescript
// pages/api/mcp/health.ts
import { MCPAggregator } from '@/backend/mcp-aggregator';

export default async function handler(req, res) {
  const aggregator = MCPAggregator.getInstance();
  await aggregator.initialize();

  const health = await aggregator.healthCheck();

  res.json(health);
}
```

### WebSocket Integration

```typescript
// Backend WebSocket server
import { MCPAggregator } from './backend/mcp-aggregator';

ws.on('message', async (message) => {
  const { query } = JSON.parse(message);

  const aggregator = MCPAggregator.getInstance();
  const result = await aggregator.executeQuery({ query });

  ws.send(JSON.stringify(result));
});
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for:
- Code style guidelines for TypeScript
- Testing requirements
- Pull request process

## License

Part of the Elastic Agent Builder NBA Demo project.
