import { QueryPlan, QueryRequest } from './types.js';

export interface PlanLogEntry {
  request: QueryRequest;
  plan: QueryPlan;
  router: string;
  source: 'llm' | 'fallback' | 'static' | 'classic-llm';
  scratchpad?: string;
  executionSucceeded: boolean;
  warnings?: string[];
  usedFallback?: boolean;
}

export class RouterMetrics {
  private observers: Array<(entry: PlanLogEntry) => void> = [];

  logPlan(entry: PlanLogEntry): void {
    for (const observer of this.observers) {
      try {
        observer(entry);
      } catch (error) {
        console.warn('[RouterMetrics] observer threw', error);
      }
    }

    if (process.env.ROUTER_METRICS_SILENT !== 'true') {
      console.info('[RouterMetrics] plan', {
        router: entry.router,
        intent: entry.plan.intent,
        tools: entry.plan.tools.map(tool => `${tool.serverId}:${tool.toolName}`),
        warnings: entry.warnings,
        source: entry.source,
        executed: entry.executionSucceeded,
        usedFallback: entry.usedFallback
      });
    }
  }

  subscribe(observer: (entry: PlanLogEntry) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index >= 0) {
        this.observers.splice(index, 1);
      }
    };
  }
}

export const routerMetrics = new RouterMetrics();
