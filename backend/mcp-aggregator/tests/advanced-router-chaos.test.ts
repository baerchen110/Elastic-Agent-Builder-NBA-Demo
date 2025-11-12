import assert from 'node:assert/strict';

import { LLMAdvancedRouter } from '../src/llm-advanced-router.js';
import { QueryIntent } from '../src/types.js';
import { CodeExecutionError } from '../src/code-execution/executor.js';
import { routeQuery as staticRouteQuery } from '../src/router.js';

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
  ]
};

process.env.ANTHROPIC_API_KEY = '';
process.env.USE_SENTIMENT_MCP_SERVER = 'true';

const router = new LLMAdvancedRouter(toolsMap);

async function testExecutorFailure() {
  const originalExecutor = (router as any).codeExecutor;
  (router as any).codeExecutor = {
    execute: async () => {
      throw new CodeExecutionError('Injected failure');
    }
  };

  const request = { query: 'Show me LeBron James stats' };
  const plan = await router.routeQuery(request);
  const fallbackPlan = staticRouteQuery(request);
  assert.deepEqual(plan, fallbackPlan, 'Plan should fall back after execution failure');

  (router as any).codeExecutor = originalExecutor;
}

function testMissingServerGuardrail() {
  const request = { query: 'Compare players' };
  const invalidPlan = {
    intent: QueryIntent.PLAYER_STATS,
    tools: [
      {
        serverId: 'nba',
        toolName: 'missing_tool',
        parameters: {}
      }
    ]
  };

  const result = (router as any).enforceGuardrails(invalidPlan, request);
  const fallbackPlan = staticRouteQuery(request);
  assert.deepEqual(result.plan, fallbackPlan, 'Guardrails should trigger fallback for missing tool');
  assert.ok(result.usedFallback);
  assert.ok(result.warnings.length > 0);
}

function testPlayerStatsWarning() {
  const request = { query: 'Give me stats' };
  const plan = {
    intent: QueryIntent.PLAYER_STATS,
    tools: [
      {
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: { query: 'stats' }
      }
    ]
  };

  const result = (router as any).enforceGuardrails(plan, request);
  assert.equal(result.usedFallback, false);
  assert.ok(result.warnings.some((warning: string) => warning.includes('PLAYER_STATS')));
}

function testSentimentGuardrail() {
  const request = { query: 'Fan sentiment?' };
  const plan = {
    intent: QueryIntent.SENTIMENT,
    tools: [
      {
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: { query: 'Fan sentiment?' }
      }
    ]
  };

  const result = (router as any).enforceGuardrails(plan, request);
  assert.equal(result.usedFallback, true);
  assert.ok(result.warnings.some((warning: string) => warning.includes('SENTIMENT intent')));
}

await testExecutorFailure();
testMissingServerGuardrail();
testPlayerStatsWarning();
testSentimentGuardrail();

console.log('✅ Advanced router chaos tests passed');
