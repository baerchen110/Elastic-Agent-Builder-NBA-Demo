# MCP Aggregator - Implementation Checklist for Claude Code

## 🎯 Goal
Build working MCP aggregator in 2-3 days that connects Kibana Agent Builder + BallDontLie API.

---

## 📝 Implementation Order

### ✅ Phase 1: Project Setup (30 min)

```bash
# Create directories
mkdir -p backend/mcp-aggregator/src/servers
mkdir -p mcp-servers/balldontlie/src/tools
mkdir -p pages/api/mcp

# Setup MCP Aggregator
cd backend/mcp-aggregator
npm init -y
npm install @modelcontextprotocol/sdk @elastic/agent-builder-mcp axios lru-cache zod
npm install -D typescript @types/node tsx

# Setup BallDontLie MCP Server  
cd ../../mcp-servers/balldontlie
npm init -y
npm install @modelcontextprotocol/sdk axios
npm install -D typescript @types/node tsx
```

**Create these config files:**
- `backend/mcp-aggregator/tsconfig.json`
- `backend/mcp-aggregator/package.json` (update scripts)
- `mcp-servers/balldontlie/tsconfig.json`
- `mcp-servers/balldontlie/package.json` (update scripts, add "type": "module")

---

### ✅ Phase 2: Type Definitions (15 min)

**File:** `backend/mcp-aggregator/src/types.ts`
- Define all TypeScript interfaces
- See full code in main document

---

### ✅ Phase 3: Query Router (30 min)

**File:** `backend/mcp-aggregator/src/router.ts`
- Intent classification
- Tool planning
- Player name extraction

---

### ✅ Phase 4: Simple Cache (15 min)

**File:** `backend/mcp-aggregator/src/cache.ts`
- LRU cache wrapper
- Cache key generation
- Stats tracking

---

### ✅ Phase 5: Elastic MCP Client (30 min)

**File:** `backend/mcp-aggregator/src/servers/elastic-client.ts`
- Connect to Kibana Agent Builder
- Use `@elastic/agent-builder-mcp` package
- List tools and call tools

---

### ✅ Phase 6: BallDontLie MCP Server (1 hour)

**Files:**
1. `mcp-servers/balldontlie/src/api-client.ts` - API wrapper
2. `mcp-servers/balldontlie/src/index.ts` - MCP server

**Tools to implement:**
- `nba_get_players` - Search players
- `nba_get_player_stats` - Get season stats
- `nba_get_games` - Get games by date
- `nba_get_teams` - Get teams

Then build:
```bash
cd mcp-servers/balldontlie
npm run build
```

---

### ✅ Phase 7: BallDontLie MCP Client (30 min)

**File:** `backend/mcp-aggregator/src/servers/balldontlie-client.ts`
- Connect to local MCP server via stdio
- List and call tools

---

### ✅ Phase 8: Main Aggregator (45 min)

**File:** `backend/mcp-aggregator/src/index.ts`
- MCPAggregator class
- Initialize connections
- Execute queries
- Combine results
- Singleton pattern

---

### ✅ Phase 9: API Routes (30 min)

**Files:**
1. `pages/api/mcp/query.ts` - Main query endpoint
2. `pages/api/mcp/health.ts` - Health check

---

### ✅ Phase 10: Environment Setup (15 min)

**File:** `.env.local` (project root)
```bash
KIBANA_URL=https://your-kibana.elastic.co
KIBANA_API_KEY=your-api-key
BALLDONTLIE_API_KEY=your-api-key
```

---

### ✅ Phase 11: Testing (30 min)

**Test Script:** `backend/mcp-aggregator/test.ts`
- Test player search
- Test stats query
- Test live games
- Test analytics

**Run:**
```bash
cd backend/mcp-aggregator
npm install dotenv
tsx test.ts
```

**API Test:**
```bash
npm run dev

# Other terminal
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Find player LeBron James"}'
```

---

### ✅ Phase 12: Frontend Test Component (30 min)

**File:** `components/MCPQueryTest.tsx`
- Query input
- Result display
- Example queries

**File:** `pages/test.tsx`
- Use MCPQueryTest component

---

### ✅ Phase 13: Sentiment MCP Server & Router Enhancements (3-4 hrs)

**Sentiment MCP Server (`mcp-servers/sentiment`)**

```bash
cd mcp-servers
mkdir sentiment && cd sentiment
npm init -y
npm install @modelcontextprotocol/sdk axios p-retry
npm install -D typescript tsx vitest @types/node
npx tsc --init --rootDir src --outDir dist --module ESNext --target ES2022
```

Key files:
- `src/index.ts` – MCP entry point registering `get_twitter_player_sentiment`, `get_reddit_player_sentiment`, `get_combined_player_sentiment`, and companion narrative/shift/comparison tools
- `src/services/*.ts` – Twitter, Reddit, narrative, and aggregation services (with fallbacks when credentials are missing)
- `src/analysis/sentiment-engine.ts` – Lightweight lexical sentiment scorer
- `src/utils/fallback.ts` – Deterministic sample generators when APIs are offline

**Aggregator Wiring (`backend/mcp-aggregator`)**
- Add `SentimentMCPClient` (stdio runner for `dist/index.js`)
- Extend `types.ts` with `sentiment` server id and `SENTIMENT` intent
- Update `router.ts` to recognize fan-buzz queries and plan sentiment tool stacks
- Enrich both `LLMRouter` and `LLMAdvancedRouter` prompts/guardrails to understand sentiment tooling
- Feature flag: `USE_SENTIMENT_MCP_SERVER=true`

**Testing**
- `cd mcp-servers/sentiment && npm run test`
- `cd backend/mcp-aggregator && npx tsx tests/advanced-router.test.ts`
- Ensure chaos tests cover sentiment guardrails

**Environment additions**
```bash
USE_SENTIMENT_MCP_SERVER=true
TWITTER_BEARER_TOKEN=<optional>
REDDIT_CLIENT_ID=<optional>
REDDIT_CLIENT_SECRET=<optional>
REDDIT_USERNAME=<optional>
REDDIT_PASSWORD=<optional>
REDDIT_APP_NAME=<optional>
SENTIMENT_WINDOW_MINUTES=180
SENTIMENT_MAX_SAMPLES=50
```

---

## 📁 Complete File Structure

```
elastic-agent-builder-nba-demo/
│
├── .env.local                         # Environment variables
│
├── backend/
│   └── mcp-aggregator/
│       ├── package.json
│       ├── tsconfig.json
│       ├── test.ts                   # Test script
│       └── src/
│           ├── index.ts              # ⭐ Main aggregator
│           ├── types.ts              # TypeScript types
│           ├── router.ts             # Query routing
│           ├── cache.ts              # Simple cache
│           └── servers/
│               ├── elastic-client.ts      # Kibana MCP client
│               └── balldontlie-client.ts  # BallDontLie MCP client
│
├── mcp-servers/
│   └── balldontlie/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # ⭐ MCP server
│           └── api-client.ts         # API wrapper
│
├── pages/
│   ├── test.tsx                      # Test page
│   └── api/
│       └── mcp/
│           ├── query.ts              # ⭐ Query endpoint
│           └── health.ts             # Health check
│
└── components/
    └── MCPQueryTest.tsx              # Test component
```

---

## 🔑 Key Implementation Notes

### Kibana Agent Builder MCP
- **Package:** `@elastic/agent-builder-mcp`
- **Connection:** Via `npx @elastic/agent-builder-mcp`
- **Environment:** Needs `KIBANA_URL` and `API_KEY`
- **Endpoint:** `{KIBANA_URL}/api/agent_builder/mcp`

### BallDontLie MCP
- **Transport:** stdio (local process)
- **API:** https://api.balldontlie.io/v1
- **Auth:** Authorization header with API key
- **Rate Limit:** ~100 requests/minute

### Router Logic
```typescript
// Intent mapping
"stats|points|ppg" → PLAYER_STATS → balldontlie + elastic
"find|search|who" → PLAYER_SEARCH → balldontlie
"live|today|score" → LIVE_GAMES → balldontlie
"analyze|predict" → ANALYTICS → elastic
"team|roster" → TEAM_INFO → balldontlie + elastic
```

### Cache Strategy
- **Type:** LRU in-memory
- **Size:** 500 items max
- **TTL:** 5 minutes
- **Key:** `serverId:toolName:params-hash`

---

## 🧪 Testing Queries

```bash
# Test 1: Player Search
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Find player LeBron James"}'

# Test 2: Player Stats
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "LeBron James stats",
    "filters": {"playerId": 237, "season": 2024}
  }'

# Test 3: Live Games
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What games are on today?"}'

# Test 4: Analytics
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze player performance trends"}'

# Health Check
curl http://localhost:3000/api/mcp/health
```

---

## ✅ Success Criteria

Your prototype works when:

1. ✅ BallDontLie MCP server builds and runs
2. ✅ Aggregator connects to both MCP servers
3. ✅ All 4 test queries return results
4. ✅ Cache hit rate increases on repeated queries
5. ✅ Health endpoint shows both servers connected
6. ✅ Frontend test component displays results

**Expected Behavior:**
- First query: ~1-2s (cache miss)
- Second identical query: ~100ms (cache hit)
- Player search: Returns player data from BallDontLie
- Stats query: Combines BallDontLie + Elastic data
- Live games: Returns today's games
- Analytics: Uses Elastic Agent Builder tools

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module @elastic/agent-builder-mcp` | `npm install @elastic/agent-builder-mcp` in aggregator dir |
| `BALLDONTLIE_API_KEY not defined` | Add to `.env.local`, restart server |
| `Failed to connect to Kibana` | Check `KIBANA_URL` and `API_KEY` |
| `BallDontLie MCP not starting` | Run `npm run build` in `mcp-servers/balldontlie` |
| API returns 500 error | Check logs, verify both MCP servers connected |
| Cache not working | Check `/api/mcp/health` for stats |

---

## 🚀 Start Here

1. **Copy all code from main document** into files listed above
2. **Follow phases 1-12 in order**
3. **Test after each phase**
4. **Verify all checkboxes** before moving on

**Estimated time:** 2-3 days for complete working prototype

**Files ready for Claude Code to implement!** 🎉
