# Sentiment MCP Server

A Model Context Protocol (MCP) server that provides social sentiment analysis for NBA topics via Twitter/X and Reddit.

## Overview

The Sentiment MCP Server enables AI agents to analyze fan sentiment, social media buzz, and narrative trends around NBA players, teams, and storylines. It aggregates data from multiple social media sources and provides sentiment scoring with resilient fallback mechanisms.

## Features

### Core Capabilities
- **Reddit Sentiment Analysis** - Community discussions and post/comment sentiment
- **Combined Sentiment** - Weighted aggregation of multiple sources with breakdown details
- **Narrative Trend Analysis** - Track narrative momentum and sentiment shifts
- **Narrative Shift Detection** - Detect sudden changes against baseline

### Resilient Design
- **Graceful Fallbacks** - Works without API credentials using annotated mock data
- **Degraded Mode** - Clearly labels fallback responses
- **Deterministic Mocks** - Consistent mock data for development
- **No Hard Failures** - Always returns usable data

## Tools

### `get_reddit_player_sentiment`
Analyze Reddit community sentiment about NBA players, teams, or topics.

**Parameters:**
- `player_name` (required): Subject to analyze
- `subreddits` (optional): Specific subreddits to search
- `timeframe` (optional): Lookback window (24h, 7d, 30d, all)
- `limit` (optional): Maximum posts/comments to sample

**Returns:**
```json
{
  "subject": "LeBron James",
  "overall_sentiment": "positive",
  "score": 0.72,
  "sample_size": 47,
  "breakdown": {
    "positive": 32,
    "neutral": 10,
    "negative": 5
  },
  "data_source": "reddit",
  "fallback_used": false
}
```

### `get_combined_player_sentiment`
Blend Twitter and Reddit sentiment signals with weighting.

**Parameters:**
- `player_name` (required): Subject to analyze
- `timeframe` (optional): Lookback window
- `limit` (optional): Max samples per source

**Returns:**
```json
{
  "subject": "Stephen Curry",
  "overall_sentiment": "positive",
  "combined_score": 0.78,
  "sources": {
    "twitter": { "score": 0.75, "weight": 0.5, "samples": 20 },
    "reddit": { "score": 0.81, "weight": 0.5, "samples": 18 }
  },
  "sample_size": 38,
  "fallback_used": false
}
```

### `analyze_player_narrative_trend`
Lightweight narrative analysis with momentum tracking.

**Parameters:**
- `player_name` (required): Player to analyze
- `timeframe` (optional): Analysis window

**Returns:**
```json
{
  "subject": "Nikola Jokic",
  "current_sentiment": "very_positive",
  "momentum": "rising",
  "key_themes": ["MVP campaign", "passing ability", "efficiency"],
  "narrative_summary": "Strong positive momentum around MVP-caliber play"
}
```

### `detect_narrative_shift`
Detect sudden sentiment shifts against 7-day baseline.

**Parameters:**
- `player_name` (required): Player to analyze
- `threshold` (optional): Sensitivity (0.1-1.0, default 0.3)

**Returns:**
```json
{
  "subject": "Anthony Davis",
  "shift_detected": true,
  "magnitude": "significant",
  "direction": "more_positive",
  "baseline_sentiment": 0.52,
  "current_sentiment": 0.78,
  "shift_score": 0.26,
  "contributing_factors": ["injury return", "dominant performance"]
}
```

### `compare_players_sentiment`
Side-by-side sentiment comparison of multiple players.

**Parameters:**
- `player_names` (required): Array of 2-5 player names
- `timeframe` (optional): Comparison window

**Returns:**
```json
{
  "comparison": [
    {
      "player": "Giannis Antetokounmpo",
      "sentiment": "positive",
      "score": 0.82,
      "rank": 1
    },
    {
      "player": "Joel Embiid",
      "sentiment": "positive",
      "score": 0.71,
      "rank": 2
    }
  ],
  "timeframe": "7d"
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Sentiment MCP Server                   │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │      MCP Protocol Handler                   │ │
│  │  (Tool registration & request handling)     │ │
│  └────────────────────────────────────────────┘ │
│                      ↓                           │
│  ┌────────────────────────────────────────────┐ │
│  │      Service Layer                          │ │
│  │  - TwitterSentimentService                  │ │
│  │  - RedditSentimentService                   │ │
│  │  - NarrativeSentimentService                │ │
│  │  - SentimentAggregationService              │ │
│  └────────────────────────────────────────────┘ │
│                      ↓                           │
│  ┌────────────────────────────────────────────┐ │
│  │      Sentiment Analysis Engine              │ │
│  │  (Shared scoring logic + fallback data)    │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
           ↓                      ↓
  ┌──────────────┐       ┌──────────────┐
  │  Twitter API │       │  Reddit API  │
  │  (Optional)  │       │  (Optional)  │
  └──────────────┘       └──────────────┘
```

## Installation

```bash
cd mcp-servers/sentiment
npm install
npm run build
```

## Configuration

### Environment Variables

**Required (for real data):**
```bash
# TwitterAPI.io credentials (Optional - uses fallback if missing)
TWITTERAPI_API_KEY=your-twitterapi-io-api-key
TWITTERAPI_PROXY_URL=optional-proxy-url

# Reddit API (Optional - uses fallback if missing)
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
REDDIT_USERNAME=your-reddit-username
REDDIT_PASSWORD=your-reddit-password
REDDIT_APP_NAME=your-reddit-app-name
```

**Optional:**
```bash
# Feature flags
TWITTER_SENTIMENT_SERVICE=true    # Enable/disable Twitter
USE_SENTIMENT_MCP_SERVER=true     # Global enable/disable

# Analysis parameters
SENTIMENT_WINDOW_MINUTES=180      # Default lookback (3 hours)
SENTIMENT_MAX_SAMPLES=50          # Max samples per source
```

Place these variables in an `.env.local` file within `mcp-servers/sentiment/` for local development. The server now loads `.env.local` (and `.env` if present) automatically before reading `process.env`, while still respecting variables provided by the MCP aggregator or parent process.

### Fallback Behavior

**Without API Credentials:**
- ✓ Server starts successfully
- ✓ All tools remain available
- ✓ Returns deterministic mock data
- ✓ Responses marked with `fallback_used: true`
- ✓ Console logs indicate fallback mode

**With Partial Credentials:**
- Twitter enabled: Uses Twitter API
- Twitter disabled: Uses Twitter fallback
- Reddit available: Uses Reddit API
- Reddit unavailable: Uses Reddit fallback

## Usage

### As MCP Server (stdio)

The server communicates via stdio following the MCP protocol:

```typescript
// In your MCP client
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./mcp-servers/sentiment/dist/index.js']
});

const client = new Client({ name: 'my-client', version: '1.0.0' }, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'get_reddit_player_sentiment',
  arguments: {
    player_name: 'LeBron James',
    timeframe: '24h'
  }
});
```

### Via MCP Aggregator

The aggregator automatically connects to this server:

```typescript
// The aggregator routes sentiment queries here
const result = await aggregator.executeQuery({
  query: "What's the fan sentiment around LeBron?"
});
// Uses get_combined_player_sentiment automatically
```

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

### Lint

```bash
npm run lint
```

## Testing

### Unit Tests

The server includes comprehensive tests for:
- Sentiment analysis engine
- Fallback mechanisms
- Service layer logic
- API integration (mocked)

**Run tests:**
```bash
npm test
```

**Test Results:**
- ✓ Sentiment engine tests (3/3)
- ✓ Service tests (5/5)
- ✓ Fallback behavior tests
- ✓ API integration tests

### Manual Testing

**Test Twitter connectivity:**
```bash
node scripts/twitter-connectivity.mjs
```

**Test via MCP Aggregator:**
```bash
cd ../../nba-commentary-web
# Visit http://localhost:3000/sentiment-test
```

## Troubleshooting

### "Sentiment MCP connection failed"

**Symptoms:** Aggregator logs connection error

**Solutions:**
1. Verify server is built: `npm run build`
2. Check dist/index.js exists
3. Test server directly: `node dist/index.js`
4. Check environment variables

### Tools marked as "degraded"

**Symptoms:** Responses include `fallback_used: true`

**Cause:** Missing API credentials

**Solutions:**
- Provide Twitter/Reddit credentials for real data
- Or accept fallback mode for development

### Empty/incorrect sentiment data

**Symptoms:** Sentiment scores seem off

**Possible Causes:**
- Fallback mode (check `fallback_used` field)
- API rate limiting
- Invalid player names

**Solutions:**
- Verify API credentials are valid
- Check API rate limits
- Ensure player names are spelled correctly

## Architecture Decisions

### Why Fallback Data?

**Problem:** Developers shouldn't need Twitter/Reddit API access for development.

**Solution:** Deterministic mock data ensures:
- Development without API keys
- Consistent test results
- No surprise failures
- Clear fallback indicators

### Why Shared Sentiment Engine?

**Problem:** Duplicate sentiment scoring logic across services.

**Solution:** Centralized engine provides:
- Consistent scoring methodology
- Single source of truth for fallbacks
- Easier testing
- Unified mock data generation

### Why Separate Services?

**Problem:** Monolithic service becomes hard to test and maintain.

**Solution:** Service layer separation enables:
- Independent testing
- Flexible source composition
- Easy addition of new sources
- Clear responsibility boundaries

## Performance

**Typical Response Times:**
- Fallback mode: <10ms
- Reddit API: 200-500ms
- Combined sentiment: 400-800ms
- Narrative analysis: 100-300ms

**Caching:**
- Aggregator caches results for 5 minutes
- Reduces redundant API calls
- Improves response times

## API Limits

**Twitter API:**
- Free tier: 1500 requests/month
- Rate limit: TBD by Twitter
- Fallback: Always available

**Reddit API:**
- Rate limit: 60 requests/minute
- OAuth: Required for auth
- Fallback: Always available

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for:
- Code style guidelines
- Testing requirements
- Pull request process

## License

Part of the Elastic Agent Builder NBA Demo project.
