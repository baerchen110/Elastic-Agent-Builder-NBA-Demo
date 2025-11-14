import { QueryIntent, QueryPlan, ToolCall } from './types.js';

export interface ParsedLLMResponse {
  plan: QueryPlan;
  scratchpad: string;
}

export function parseAdvancedRouterResponse(text: string): ParsedLLMResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('LLM response did not include JSON payload');
  }

  let payload: any;
  try {
    payload = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error('LLM response contained invalid JSON');
  }

  if (!payload.plan || !payload.scratchpad) {
    throw new Error('LLM response missing plan or scratchpad');
  }

  const intent = coerceIntent(payload.plan.intent);
  const tools: ToolCall[] = Array.isArray(payload.plan.tools) ? payload.plan.tools.map((tool: any) => ({
    serverId: tool.serverId,
    toolName: tool.toolName,
    parameters: tool.parameters ?? {}
  })) : [];

  return {
    plan: {
      intent,
      tools
    },
    scratchpad: String(payload.scratchpad)
  };
}

export function coerceIntent(intent: string): QueryIntent {
  if (!intent) return QueryIntent.UNKNOWN;
  const normalized = intent.toUpperCase();
  for (const value of Object.values(QueryIntent)) {
    if (value.toUpperCase() === normalized) {
      return value as QueryIntent;
    }
  }
  return QueryIntent.UNKNOWN;
}
