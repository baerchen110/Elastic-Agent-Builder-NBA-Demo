import assert from 'node:assert/strict';

import { CodeExecutionEngine, CodeExecutionError } from '../src/code-execution/executor.js';
import { QueryIntent } from '../src/types.js';

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

const request = { query: 'Find player data' };

const engine = new CodeExecutionEngine();

async function testSuccessfulExecution() {
  const code = `
    const call = helpers.buildToolCall('elastic', 'platform_core_search', { query: request.query });
    return helpers.buildPlan(helpers.QueryIntent.PLAYER_SEARCH, [call]);
  `;

  const plan = await engine.execute({ code, request, toolsMap });
  assert.equal(plan.intent, QueryIntent.PLAYER_SEARCH);
  assert.equal(plan.tools.length, 1);
  assert.equal(plan.tools[0].toolName, 'platform_core_search');
}

async function testUnknownTool() {
  const code = `
    const call = helpers.buildToolCall('elastic', 'missing_tool', {});
    return helpers.buildPlan('UNKNOWN', [call]);
  `;

  await assert.rejects(async () => {
      await engine.execute({ code, request, toolsMap });
    }, (error: any) => {
      if (!(error instanceof CodeExecutionError)) {
        return false;
      }
        const enriched = error as CodeExecutionError & { cause?: { message?: string } };
        const message = enriched.message + (enriched.cause?.message ? ` ${enriched.cause.message}` : '');
        return /Unknown tool/.test(message);
    });
}

async function testTimeout() {
  const code = `
    await new Promise(() => {});
  `;

  await assert.rejects(async () => {
    await engine.execute({ code, request, toolsMap, timeoutMs: 200 });
  }, (error: any) => error instanceof CodeExecutionError && /exceeded/.test(error.message));
}

await testSuccessfulExecution();
await testUnknownTool();
await testTimeout();

console.log('✅ CodeExecutionEngine unit tests passed');
