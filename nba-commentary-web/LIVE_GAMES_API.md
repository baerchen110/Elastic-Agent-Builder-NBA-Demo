# Live Games API Endpoint

## Overview
REST API endpoint that fetches current NBA games and extracts player information from the MCP aggregator.

---

## Endpoint

**URL:** `/api/live-games`
**Method:** `GET`
**Timeout:** 10 seconds

---

## Response Format

```typescript
{
  games: Array<{
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    topPlayers: Array<{
      name: string;
      team: string;
      points: number;
      rebounds: number;
      assists: number;
    }>;
    status: 'live' | 'upcoming' | 'final';
    statusText: string;
  }>;
  hasLiveGames: boolean;
  totalGames: number;
  error?: string;
}
```

---

## Example Response

```json
{
  "games": [
    {
      "gameId": "0022500198",
      "homeTeam": "Charlotte Hornets",
      "awayTeam": "Los Angeles Lakers",
      "homeScore": 111,
      "awayScore": 121,
      "topPlayers": [
        {
          "name": "Miles Bridges",
          "team": "Charlotte Hornets",
          "points": 34,
          "rebounds": 8,
          "assists": 5
        },
        {
          "name": "Luka Dončić",
          "team": "Los Angeles Lakers",
          "points": 38,
          "rebounds": 6,
          "assists": 7
        }
      ],
      "status": "final",
      "statusText": "Final"
    }
  ],
  "hasLiveGames": false,
  "totalGames": 9
}
```

---

## Status Values

| Status | Description | NBA API Value |
|--------|-------------|---------------|
| `upcoming` | Game scheduled but not started | gameStatus = 1 |
| `live` | Game currently in progress | gameStatus = 2 |
| `final` | Game completed | gameStatus = 3 |

---

## Top Players

Each game returns **2 top players**:
- **Home team leader** (highest scoring player)
- **Away team leader** (highest scoring player)

Player data includes:
- Full name
- Team name (city + team)
- Points scored
- Rebounds
- Assists

---

## Edge Cases Handled

### ✅ No Live Games
```json
{
  "games": [...],
  "hasLiveGames": false,
  "totalGames": 9
}
```

### ✅ Method Not Allowed (POST, PUT, etc.)
```json
{
  "games": [],
  "hasLiveGames": false,
  "totalGames": 0,
  "error": "Method not allowed"
}
```

### ✅ Request Timeout (>10 seconds)
```json
{
  "games": [],
  "hasLiveGames": false,
  "totalGames": 0,
  "error": "Request timeout - live games API took too long to respond"
}
```

### ✅ MCP API Error
```json
{
  "games": [],
  "hasLiveGames": false,
  "totalGames": 0,
  "error": "Failed to fetch live games"
}
```

---

## Implementation Details

### Data Flow

```
Client Request
    ↓
GET /api/live-games
    ↓
POST /api/mcp/query
  query: "get current live games"
    ↓
MCP Aggregator
    ↓
Elastic Agent Builder (get_current_live_games tool)
    ↓
NBA API (scoreboard endpoint)
    ↓
Transform & Return
```

### Transformation Logic

1. **Parse MCP Response**
   - Extract JSON from `data.results.nba[0].content[0].text`
   - Get games array from `scoreboard.games`

2. **Extract Game Data**
   - Team names (city + name)
   - Scores
   - Game status
   - Game leaders (top players)

3. **Transform to Simplified Format**
   - Flatten team structure
   - Map status codes to readable strings
   - Extract only essential player stats

---

## Usage Examples

### Fetch All Games (Live + Completed)
```bash
curl http://localhost:3000/api/live-games
```

### Check if Games are Live
```bash
curl http://localhost:3000/api/live-games | jq '.hasLiveGames'
```

### Get Only Live Games
```bash
curl http://localhost:3000/api/live-games | jq '.games[] | select(.status == "live")'
```

### Get Top Scorers
```bash
curl http://localhost:3000/api/live-games | jq '.games[].topPlayers[] | select(.points > 30)'
```

---

## Testing Results

### ✅ Success Criteria Met

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Endpoint responds at `/api/live-games` | ✅ | Returns 200 status |
| Returns structured data with games and players | ✅ | 9 games, each with 2 players |
| Handles no live games gracefully | ✅ | `hasLiveGames: false` when all games final |
| Handles errors without crashing | ✅ | 405 for POST, 504 for timeout, 500 for errors |
| Timeout handling (10 seconds) | ✅ | `AbortSignal.timeout(10000)` |
| Proper error messages | ✅ | Descriptive error strings |

### Test Cases Executed

```bash
# ✅ GET request succeeds
curl http://localhost:3000/api/live-games
# Returns: 9 games

# ✅ POST request fails with 405
curl -X POST http://localhost:3000/api/live-games
# Returns: {"error": "Method not allowed"}

# ✅ Game status counts
curl http://localhost:3000/api/live-games | jq '{totalGames, hasLiveGames, liveCount: ...}'
# Returns: {totalGames: 9, hasLiveGames: false, liveCount: 0, finalCount: 9}

# ✅ Top players extracted
curl http://localhost:3000/api/live-games | jq '.games[0].topPlayers'
# Returns: 2 players with full stats
```

---

## Performance

- **Response Time:** ~2-3 seconds (depends on MCP aggregator)
- **Timeout:** 10 seconds max
- **Caching:** Not implemented (always fetches fresh data)
- **Rate Limiting:** Not implemented

---

## Integration with Stats and Buzz Chat

This endpoint can be used in the `/statsandbuzz/chat` page to:

1. **Display Live Game Ticker**
   - Show live scores in real-time
   - Highlight top performers

2. **Context for Chat Queries**
   - "Who's playing right now?"
   - "Show me live game stats"
   - "How is [player] doing tonight?"

3. **Automatic Updates**
   - Poll endpoint every 30-60 seconds
   - Display notifications for game events
   - Update player stats dynamically

---

## Future Enhancements

1. **Caching**
   - Cache responses for 30-60 seconds
   - Reduce load on MCP aggregator

2. **WebSocket Support**
   - Push live score updates
   - Real-time player stat changes

3. **Filtering**
   - Query params: `?status=live` (only live games)
   - Query params: `?team=LAL` (specific team)

4. **Expanded Player Data**
   - Include more players (top 3-5 per team)
   - Add shooting percentages
   - Add +/- rating

5. **Game Details**
   - Quarter/period information
   - Time remaining
   - Recent plays

---

## Error Handling Flow

```
Request → Validate Method
           ↓
       Call MCP API
           ↓
    Check Response
           ↓
    Parse Games
           ↓
   Transform Data
           ↓
    Return JSON

Errors handled at each step:
- Invalid method → 405
- Timeout → 504
- MCP error → 500
- Parse error → 500 with empty array
```

---

## File Location

**Path:** `/pages/api/live-games.ts`

**Related Files:**
- `/pages/api/mcp/query.ts` - MCP aggregator endpoint
- `/backend/mcp-aggregator/src/servers/elastic-client.ts` - Elastic MCP client
- `/backend/mcp-aggregator/src/tool-metadata.ts` - Tool metadata

---

## Dependencies

- `next` - Next.js API routes
- MCP Aggregator - For NBA data access
- Elastic Agent Builder - For `get_current_live_games` tool

---

## Documentation

**API Documentation:** This file
**MCP Tools:** Available at `/api/mcp/tools`
**Health Check:** Available at `/api/mcp/health`

---

## Summary

✅ **Production-ready** live games API endpoint that:
- Fetches real-time NBA game data
- Extracts top player performances
- Handles all edge cases gracefully
- Returns consistent, structured data
- Ready for integration with Stats and Buzz chat interface

**Ready for Phase 4: Display live games in the chat UI!** 🏀
