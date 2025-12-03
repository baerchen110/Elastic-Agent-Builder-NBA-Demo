import assert from 'node:assert/strict';

import { parseAdvancedRouterResponse, coerceIntent } from '../src/llm-advanced-parser.js';
import { QueryIntent } from '../src/types.js';

const samplePayload = {
  plan: {
    intent: 'player_stats',
    tools: [
      {
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: {
          query: 'LeBron James stats'
        }
      }
    ]
  },
  scratchpad: "const call = helpers.buildToolCall('elastic','platform_core_search',{query: request.query});\nreturn helpers.buildPlan('PLAYER_STATS',[call]);"
};

const sampleResponse = `Here is your plan:\n${JSON.stringify(samplePayload, null, 2)}`;

const parsed = parseAdvancedRouterResponse(sampleResponse);
assert.equal(parsed.plan.intent, QueryIntent.PLAYER_STATS);
assert.equal(parsed.plan.tools.length, 1);
assert.equal(parsed.plan.tools[0].toolName, 'platform_core_search');
assert.ok(parsed.scratchpad.includes('buildPlan'));

assert.equal(coerceIntent('analytics'), QueryIntent.ANALYTICS);
assert.equal(coerceIntent('sentiment'), QueryIntent.SENTIMENT);
assert.equal(coerceIntent('unknown-intent'), QueryIntent.UNKNOWN);

assert.throws(() => parseAdvancedRouterResponse('No JSON here'), /did not include JSON/);

console.log('✅ Advanced router parser tests passed');
