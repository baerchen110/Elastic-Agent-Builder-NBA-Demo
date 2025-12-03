# Environment Variables Externalization - Implementation Plan

**Project:** Elastic Agent Builder NBA Demo
**Date:** November 2025
**Status:** Ready for Implementation

---

## Executive Summary

**Goal:** Externalize 43 hardcoded configuration values to environment variables across 18 source files.

**Impact:**
- Improved security (no hardcoded credentials)
- Deployment flexibility (no code changes for config updates)
- Environment-specific configuration (dev, staging, prod)
- Easier model version updates

**Effort Estimate:** 8-12 hours
**Risk Level:** Medium (requires testing across all components)

---

## Scope

### Files to Modify: 18
- 7 TypeScript/JavaScript files (Frontend & MCP Aggregator)
- 4 Python files (Data ingestion scripts)
- 3 Python files (A2A backend)
- 4 Configuration files (existing, no changes needed)

### Environment Variables: 43 total
- **CRITICAL:** 8 (blocks deployment/runtime)
- **HIGH:** 6 (operational flexibility)
- **MEDIUM:** 24 (performance tuning)
- **LOW:** 5 (optional conveniences)

### Already Implemented: 3
- `SENTIMENT_MCP_PATH` ✅
- `FASTAPI_PORT`, `FASTAPI_HOST` ✅

---

## Implementation Phases

### Phase 0: CRITICAL - Immediate Blockers (2 hours)

**Priority:** 🔴 Must complete before deployment

#### Task 0.1: Fix Frontend WebSocket URL
**File:** `/nba-commentary-web/hooks/useChat.ts:22`

**Current Code:**
```typescript
const wsUrl = 'ws://localhost:3001';
```

**New Code:**
```typescript
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
```

**Testing:**
- Run `npm run dev` and verify frontend connects
- Check browser console for WebSocket connection
- Test in deployed environment with production URL

---

#### Task 0.2: Create A2A Backend Environment File
**File:** `/a2a-backend/.env` (NEW)

**Action:** Copy template from `.env.local.example` lines 146-165

**Required Variables:**
```bash
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT_NAME=
ELASTIC_STATS_AGENT_URL=
ELASTIC_MEDIA_AGENT_URL=
ELASTIC_API_KEY=
```

**Testing:**
```bash
cd a2a-backend
python api_server_with_deepagent.py
# Should start without "Missing Azure OpenAI credentials" error
```

---

### Phase 1: HIGH Priority - Operational Flexibility (3 hours)

**Priority:** 🟠 Important for production

#### Task 1.1: Externalize LLM Model Versions (3 files)

**File 1:** `/backend/mcp-aggregator/src/llm-router.ts:132`

**Current:**
```typescript
model: 'claude-sonnet-4-20250514',
```

**New:**
```typescript
model: process.env.LLM_ROUTER_MODEL || 'claude-sonnet-4-20250514',
```

---

**File 2:** `/backend/mcp-aggregator/src/llm-advanced-router.ts:92-94`

**Current:**
```typescript
model: 'claude-sonnet-4-20250514',
max_tokens: 1800,
temperature: 0.3,
```

**New:**
```typescript
model: process.env.LLM_ADVANCED_ROUTER_MODEL || 'claude-sonnet-4-20250514',
max_tokens: parseInt(process.env.LLM_ADVANCED_ROUTER_MAX_TOKENS || '1800'),
temperature: parseFloat(process.env.LLM_ADVANCED_ROUTER_TEMPERATURE || '0.3'),
```

---

**File 3:** `/nba-commentary-web/lib/llm-summarizer.ts:92-94`

**Current:**
```typescript
model: 'claude-sonnet-4-20250514',
max_tokens: 2000,
temperature: 0.7,
```

**New:**
```typescript
model: process.env.LLM_SUMMARIZER_MODEL || 'claude-sonnet-4-20250514',
max_tokens: parseInt(process.env.LLM_SUMMARIZER_MAX_TOKENS || '2000'),
temperature: parseFloat(process.env.LLM_SUMMARIZER_TEMPERATURE || '0.7'),
```

**Also update lines 88, 140:**
```typescript
// Line 88
truncateResults(input.results, parseInt(process.env.LLM_SUMMARIZER_MAX_RESULT_LENGTH || '8000'))

// Line 140
return results.slice(0, parseInt(process.env.LLM_SUMMARIZER_MAX_ARRAY_ITEMS || '5'));
```

**Testing:**
- Run MCP aggregator tests: `cd backend/mcp-aggregator && npm test`
- Test summarizer in frontend with different model versions
- Verify fallback to defaults when env vars not set

---

#### Task 1.2: Externalize API Timeouts

**File:** `/nba-commentary-web/nba-backend/server.js`

**Lines 58, 229:**
```javascript
// Line 58 - Change from:
timeout: 5000
// To:
timeout: parseInt(process.env.AGENTS_API_TIMEOUT_MS || '5000')

// Line 229 - Change from:
timeout: 120000
// To:
timeout: parseInt(process.env.QUERY_API_TIMEOUT_MS || '120000')
```

**Lines 340-341 (optional):**
```javascript
// Change from:
await new Promise(resolve => setTimeout(resolve, 20));
// To:
const delay = parseInt(process.env.WORD_STREAMING_DELAY_MS || '20');
await new Promise(resolve => setTimeout(resolve, delay));
```

**Testing:**
- Start backend: `cd nba-commentary-web/nba-backend && npm start`
- Test with short timeout (set to 100ms) to verify it's being used
- Verify default fallback works without env var

---

#### Task 1.3: Externalize NBA Season

**File:** `/data/ingest/ingest_game_logs.py:42`

**Current:**
```python
season='2024-25'
```

**New:**
```python
import os
season = os.getenv('NBA_CURRENT_SEASON', '2024-25')
```

**Also check similar usage in:**
- `ingest_player_stats.py`
- Any other ingestion scripts

**Testing:**
```bash
cd data/ingest
export NBA_CURRENT_SEASON="2024-25"
python ingest_game_logs.py --dry-run  # Add dry-run flag if available
```

---

### Phase 2: MEDIUM Priority - Performance & Flexibility (4 hours)

**Priority:** 🟡 Improves maintainability

#### Task 2.1: Cache Configuration

**File:** `/backend/mcp-aggregator/src/index.ts:50-51`

**Current:**
```typescript
this.cache = new LRUCache({
  maxSize: 500,
  ttl: 5 * 60 * 1000,
});
```

**New:**
```typescript
this.cache = new LRUCache({
  maxSize: parseInt(process.env.MCP_CACHE_MAX_SIZE || '500'),
  ttl: parseInt(process.env.MCP_CACHE_TTL_MS || '300000'),
});
```

---

#### Task 2.2: MCP Server Paths

**File:** `/backend/mcp-aggregator/src/servers/balldontlie-client.ts:31`

**Current:**
```typescript
const serverPath = path.resolve(__dirname, '../../../../mcp-servers/balldontlie/dist/index.js');
```

**New:**
```typescript
const serverPath = process.env.BALLDONTLIE_MCP_SERVER_PATH ||
  path.resolve(__dirname, '../../../../mcp-servers/balldontlie/dist/index.js');
```

---

#### Task 2.3: Code Executor Timeout

**File:** `/backend/mcp-aggregator/src/code-execution/executor.ts:26`

**Current:**
```typescript
private readonly defaultTimeout = 2000;
```

**New:**
```typescript
private readonly defaultTimeout = parseInt(process.env.CODE_EXECUTOR_TIMEOUT_MS || '2000');
```

---

#### Task 2.4: BallDontLie API Configuration

**File:** `/mcp-servers/balldontlie/src/api-client.ts`

**Lines 8, 82, 167:**
```typescript
// Line 8 - Change from:
const BASE_URL = 'https://api.balldontlie.io/v1';
// To:
const BASE_URL = process.env.BALLDONTLIE_API_BASE_URL || 'https://api.balldontlie.io/v1';

// Line 82 - Change from:
timeout: 10000
// To:
timeout: parseInt(process.env.BALLDONTLIE_API_TIMEOUT_MS || '10000')

// Line 167 - Change from:
params: { per_page: 100 }
// To:
params: { per_page: parseInt(process.env.BALLDONTLIE_TEAMS_PER_PAGE || '100') }
```

---

#### Task 2.5: Elasticsearch Index Names (4 files)

**File 1:** `/data/ingest/ingest_game_schedule.py:10`
```python
INDEX_NAME = os.getenv('ES_INDEX_GAME_SCHEDULE', 'nba-game-schedule')
```

**File 2:** `/data/ingest/stream_live_games.py:46`
```python
index = os.getenv('ES_INDEX_LIVE_GAMES', 'nba-live-games')
```

**File 3:** `/data/ingest/ingest_player_stats.py` (similar pattern)
```python
INDEX_NAME = os.getenv('ES_INDEX_PLAYER_STATS', 'nba-player-stats')
```

**File 4:** `/data/ingest/ingest_game_logs.py` (similar pattern)
```python
INDEX_NAME = os.getenv('ES_INDEX_GAME_LOGS', 'nba-player-game-logs')
```

---

#### Task 2.6: NBA API Configuration

**File:** `/data/ingest/ingest_game_schedule.py`

**Lines 13, 89, 155:**
```python
# Line 13
NBA_SCHEDULE_URL = os.getenv(
    'NBA_SCHEDULE_API_URL',
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json'
)

# Line 89
timeout = int(os.getenv('NBA_API_TIMEOUT_SECONDS', '30'))

# Line 155
chunk_size = int(os.getenv('ES_BULK_CHUNK_SIZE', '100'))
```

**File:** `/data/ingest/ingest_game_logs.py:56`
```python
delay = float(os.getenv('NBA_API_RATE_LIMIT_DELAY_SECONDS', '0.6'))
time.sleep(delay)
```

**Similar for:** `ingest_player_stats.py`, `stream_live_games.py`

---

#### Task 2.7: Tracked Players Configuration

**File:** `/data/ingest/ingest_game_logs.py:17-28`

**Current:**
```python
TRACKED_PLAYERS = {
    "2544": "LeBron James",
    "203999": "Nikola Jokic",
    # ... 8 more
}
```

**New:**
```python
import json

def load_tracked_players():
    """Load tracked players from env var or use defaults"""
    players_json = os.getenv('TRACKED_PLAYERS')
    if players_json:
        try:
            players_list = json.loads(players_json)
            return {p['id']: p['name'] for p in players_list}
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing TRACKED_PLAYERS: {e}, using defaults")

    # Default players
    return {
        "2544": "LeBron James",
        "203999": "Nikola Jokic",
        "201939": "Stephen Curry",
        "1629029": "Luka Doncic",
        "1630162": "Shai Gilgeous-Alexander",
        "1628369": "Jayson Tatum",
        "1630178": "Anthony Edwards",
        "1630533": "LaMelo Ball",
        "203507": "Giannis Antetokounmpo",
        "1626164": "Joel Embiid"
    }

TRACKED_PLAYERS = load_tracked_players()
```

---

### Phase 3: LOW Priority - Optional Conveniences (2 hours)

**Priority:** 🟢 Nice to have

#### Task 3.1: WebSocket Reconnect Delay

**File:** `/nba-commentary-web/hooks/useChat.ts:57`

**Current:**
```typescript
reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
```

**New:**
```typescript
const reconnectDelay = parseInt(process.env.NEXT_PUBLIC_WS_RECONNECT_DELAY_MS || '3000');
reconnectTimeoutRef.current = setTimeout(connectWebSocket, reconnectDelay);
```

---

#### Task 3.2: Live Games Update Interval

**File:** `/data/ingest/stream_live_games.py:57`

**Current:**
```python
def stream_live_games(interval=30):
```

**New:**
```python
def stream_live_games(interval=None):
    if interval is None:
        interval = int(os.getenv('LIVE_GAMES_UPDATE_INTERVAL_SECONDS', '30'))
```

---

### Phase 4: Build & Configuration Updates (1 hour)

#### Task 4.1: Update TypeScript Build

Ensure all TypeScript files compile with new env var usage:

```bash
cd backend/mcp-aggregator
npm run build

cd ../../mcp-servers/balldontlie
npm run build

cd ../sentiment
npm run build

cd ../../nba-commentary-web
npm run build
```

---

#### Task 4.2: Update Python Requirements

Check if `python-dotenv` is in requirements:

**File:** `/a2a-backend/requirements.txt`
```txt
python-dotenv>=1.0.0
```

**File:** `/data/ingest/requirements.txt`
```txt
python-dotenv>=1.0.0
```

Add if missing, then:
```bash
pip install -r requirements.txt
```

---

#### Task 4.3: Add .env Loading to Python Scripts

Ensure each Python file loads dotenv at the top:

```python
from dotenv import load_dotenv
import os

load_dotenv()
# ... rest of imports
```

---

## Testing Strategy

### Unit Tests

**MCP Aggregator:**
```bash
cd backend/mcp-aggregator
npm test
```

**Sentiment MCP:**
```bash
cd mcp-servers/sentiment
npm run test
```

---

### Integration Tests

**1. Frontend → Backend → Python Backend:**
```bash
# Terminal 1: Start Python backend
cd a2a-backend
python api_server_with_deepagent.py

# Terminal 2: Start Node backend
cd nba-commentary-web/nba-backend
npm start

# Terminal 3: Start frontend
cd nba-commentary-web
npm run dev

# Test: Open http://localhost:3001 and send a query
```

---

**2. Data Ingestion:**
```bash
cd data/ingest
# Test with custom values
export NBA_CURRENT_SEASON="2024-25"
export ES_INDEX_GAME_SCHEDULE="test-game-schedule"
python ingest_game_schedule.py
```

---

**3. MCP Services:**
```bash
cd backend/mcp-aggregator
# Test aggregator with custom cache settings
export MCP_CACHE_MAX_SIZE=100
export MCP_CACHE_TTL_MS=60000
npm start
```

---

### Environment-Specific Testing

**Test with missing env vars (should use defaults):**
```bash
unset LLM_ROUTER_MODEL
npm run dev
# Should use claude-sonnet-4-20250514 by default
```

**Test with custom env vars:**
```bash
export LLM_ROUTER_MODEL="claude-opus-4-20250514"
npm run dev
# Should use opus model
```

---

## Rollback Plan

### Git Strategy

**Before starting:**
```bash
git checkout -b feature/env-externalization
git commit -m "Checkpoint before env externalization"
```

**After each phase:**
```bash
git add -A
git commit -m "Phase N: [description]"
```

**If issues arise:**
```bash
# Rollback to last good commit
git reset --hard HEAD~1

# Or abandon entire branch
git checkout main
git branch -D feature/env-externalization
```

---

### Backup Files

Before modifying critical files, create backups:
```bash
cp file.ts file.ts.backup
```

---

## Deployment Checklist

### Development Environment

- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Fill in all [CRITICAL] variables
- [ ] Test all services start successfully
- [ ] Verify frontend connects to backend

---

### Staging Environment

- [ ] Create staging-specific `.env.local`
- [ ] Update `NEXT_PUBLIC_WS_URL` to staging backend
- [ ] Update all URLs to staging Elasticsearch/Kibana
- [ ] Run full integration test suite
- [ ] Verify a2a-backend connects to Azure OpenAI

---

### Production Environment

- [ ] Create production `.env.local`
- [ ] Update `NEXT_PUBLIC_WS_URL` to production backend URL
- [ ] Use production Elasticsearch/Kibana URLs
- [ ] Set production API keys (Azure OpenAI, Anthropic, etc.)
- [ ] Test with production NBA API limits
- [ ] Monitor logs for missing env var warnings

---

## Risk Assessment

### High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing NEXT_PUBLIC_ prefix breaks frontend | HIGH | Test in dev before deploy |
| Typo in env var name causes silent fallback | MEDIUM | Add logging for env var usage |
| Python scripts fail without dotenv | HIGH | Add to requirements.txt first |
| Azure OpenAI credentials in logs | CRITICAL | Never log credential values |

---

### Common Pitfalls

1. **Next.js env vars:** Must restart dev server after changing `.env.local`
2. **NEXT_PUBLIC_ vars:** Only available in client-side code
3. **parseInt/parseFloat:** Always provide fallback string
4. **Python dotenv:** Must call `load_dotenv()` before accessing env vars
5. **Empty string vs undefined:** `process.env.VAR || 'default'` handles both

---

## Success Criteria

### Phase Completion

- [x] Phase 0: No deployment blockers, a2a-backend starts
- [ ] Phase 1: All LLM models configurable, timeouts work
- [ ] Phase 2: All performance settings tunable via env
- [ ] Phase 3: All convenience settings working
- [ ] Phase 4: Clean builds, all tests passing

---

### Final Validation

- [ ] No hardcoded URLs in source code (except defaults)
- [ ] No hardcoded API keys anywhere
- [ ] All 43 env vars documented in `.env.local.example`
- [ ] README updated with env var setup instructions
- [ ] All tests passing with default values
- [ ] All tests passing with custom values
- [ ] Production deployment successful

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Critical | 2 hours | None |
| Phase 1: High | 3 hours | Phase 0 complete |
| Phase 2: Medium | 4 hours | Phase 1 complete |
| Phase 3: Low | 2 hours | Phase 2 complete |
| Phase 4: Build | 1 hour | All phases done |
| **Total** | **12 hours** | Sequential |

**Recommended Schedule:**
- Day 1 Morning: Phase 0 + Phase 1 (5 hours)
- Day 1 Afternoon: Phase 2 (4 hours)
- Day 2 Morning: Phase 3 + Phase 4 + Testing (3 hours)

---

## Post-Implementation

### Documentation Updates

1. Update `README.md` with environment setup section
2. Update `CLAUDE.md` with new env var patterns
3. Create `DEPLOYMENT.md` with env-specific configs
4. Add env var reference table to docs

---

### Monitoring

Add logging to verify env vars are being used:

```typescript
console.log(`Using LLM model: ${process.env.LLM_ROUTER_MODEL || 'default'}`);
console.log(`Cache size: ${process.env.MCP_CACHE_MAX_SIZE || 'default'}`);
```

---

### Future Improvements

1. **Add validation:** Create a script to validate all required env vars are set
2. **Secret management:** Consider using secrets manager for production
3. **Config service:** Centralize config access through a service layer
4. **Type safety:** Add TypeScript types for env vars

---

## Appendix: File Change Summary

| File | Lines | Priority | Complexity |
|------|-------|----------|------------|
| `useChat.ts` | 1 line | CRITICAL | Easy |
| `llm-router.ts` | 3 lines | HIGH | Easy |
| `llm-advanced-router.ts` | 5 lines | HIGH | Easy |
| `llm-summarizer.ts` | 7 lines | HIGH | Medium |
| `server.js` | 4 lines | HIGH | Easy |
| `index.ts` (aggregator) | 2 lines | MEDIUM | Easy |
| `executor.ts` | 1 line | MEDIUM | Easy |
| `balldontlie-client.ts` | 2 lines | MEDIUM | Easy |
| `api-client.ts` (balldontlie) | 3 lines | MEDIUM | Easy |
| `ingest_game_schedule.py` | 3 lines | MEDIUM | Easy |
| `ingest_game_logs.py` | 20 lines | MEDIUM | Hard |
| `ingest_player_stats.py` | 3 lines | MEDIUM | Easy |
| `stream_live_games.py` | 2 lines | MEDIUM | Easy |
| **TOTAL** | **~56 lines** | - | - |

---

## Questions & Support

**Blockers:** Contact team lead immediately
**Questions:** Review this plan or check `.env.local.example`
**Issues:** Create backup before making changes

---

**Document Version:** 1.0
**Last Updated:** November 2025
**Owner:** Development Team
