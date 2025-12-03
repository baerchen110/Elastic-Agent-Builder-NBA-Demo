import assert from 'node:assert/strict';

process.env.USE_NBA_MCP_SERVER = 'true';
process.env.USE_SENTIMENT_MCP_SERVER = 'true';
process.env.ANTHROPIC_API_KEY = '';

const toolsMap = {
  elastic: [
    {
      name: 'platform_core_search',
      description: 'Elastic semantic search',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    }
  ],
  nba: [
    {
      name: 'nba_list_todays_games',
      description: 'NBA games for today',
      inputSchema: {
        type: 'object',
        properties: {
          game_date: { type: 'string' },
          league_id: { type: 'string' }
        },
        required: ['game_date']
      }
    }
  ],
  sentiment: [
    {
      name: 'get_combined_player_sentiment',
      description: 'Aggregated social sentiment',
      inputSchema: {
        type: 'object',
        properties: {
          player_name: { type: 'string' }
        },
        required: ['player_name']
      }
    },
    {
      name: 'get_twitter_player_sentiment',
      description: 'Twitter sentiment summary',
      inputSchema: {
        type: 'object',
        properties: {
          player_name: { type: 'string' }
        },
        required: ['player_name']
      }
    },
    {
      name: 'analyze_player_narrative_trend',
      description: 'Narrative synthesis',
      inputSchema: {
        type: 'object',
        properties: {
          player_name: { type: 'string' }
        },
        required: ['player_name']
      }
    }
  ]
};

const { LLMAdvancedRouter } = await import('../src/llm-advanced-router.js');
const { QueryIntent } = await import('../src/types.js');

const router = new LLMAdvancedRouter(toolsMap);

async function testPlayerStats() {
  const plan = await router.routeQuery({ query: 'Show me LeBron James stats' });
  assert.equal(plan.intent, QueryIntent.PLAYER_STATS);
  assert.ok(plan.tools.length >= 1, 'Expected at least one tool call');
  assert.equal(plan.tools[0].toolName, 'platform_core_search');
}

async function testLiveGames() {
  const plan = await router.routeQuery({ query: 'What games are on today?' });
  assert.equal(plan.intent, QueryIntent.LIVE_GAMES);
  assert.ok(plan.tools.length >= 1, 'Expected NBA tool call');
  assert.equal(plan.tools[0].toolName, 'nba_list_todays_games');
}

async function testAnalytics() {
  const plan = await router.routeQuery({ query: 'Predict playoff outcomes for Western Conference teams' });
  assert.equal(plan.intent, QueryIntent.ANALYTICS);
  assert.ok(plan.tools.length >= 1, 'Expected at least one tool call');
  assert.equal(plan.tools[0].toolName, 'platform_core_search');
}

async function testSentiment() {
  const plan = await router.routeQuery({ query: 'What are fans on Twitter saying about the Lakers tonight?' });
  assert.equal(plan.intent, QueryIntent.SENTIMENT);
  assert.ok(plan.tools.some(tool => tool.serverId === 'sentiment'), 'Expected sentiment tool in plan');
  assert.ok(
    plan.tools.some(tool => tool.serverId === 'sentiment' && tool.toolName === 'get_combined_player_sentiment'),
    'Expected combined sentiment tool call'
  );
}

await testPlayerStats();
await testLiveGames();
await testAnalytics();
await testSentiment();

console.log('✅ LLMAdvancedRouter integration tests passed');
