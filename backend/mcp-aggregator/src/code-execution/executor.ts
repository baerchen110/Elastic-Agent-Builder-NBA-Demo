import vm from 'node:vm';
import { QueryIntent, QueryPlan, QueryRequest, MCPTool, MCPServerId, ToolCall } from '../types.js';

interface ToolsMap {
  [serverId: string]: MCPTool[];
}

export interface ExecutionOptions {
  code: string;
  request: QueryRequest;
  toolsMap: ToolsMap;
  timeoutMs?: number;
}

export class CodeExecutionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'CodeExecutionError';
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
  }
}

export class CodeExecutionEngine {
  private readonly defaultTimeout = parseInt(process.env.CODE_EXECUTOR_TIMEOUT_MS || '2000', 10);

  async execute(options: ExecutionOptions): Promise<QueryPlan> {
    const { code, request, toolsMap, timeoutMs } = options;

    if (!code || typeof code !== 'string') {
      throw new CodeExecutionError('Scratchpad code must be a non-empty string');
    }

  const contextObject = this.buildSandbox(request, toolsMap);
    const context = vm.createContext(contextObject);

    const wrapped = `(async () => {\n${code}\n})()`;
    const script = new vm.Script(wrapped);

    try {
      const resultPromise = script.runInContext(context, { timeout: this.defaultTimeout });
      const result = await this.withTimeout(resultPromise, timeoutMs ?? this.defaultTimeout);
      return this.validatePlan(result, toolsMap);
    } catch (error: any) {
      if (error instanceof CodeExecutionError) {
        throw error;
      }
      throw new CodeExecutionError('Scratchpad execution failed', { cause: error });
    }
  }

  private buildSandbox(request: QueryRequest, toolsMap: ToolsMap) {
  const frozenRequest = deepFreeze(cloneValue(request));
  const frozenTools = deepFreeze(cloneValue(toolsMap));

    const helpers = {
      QueryIntent,
      listTools: () => frozenTools,
      hasTool(serverId: MCPServerId, toolName: string): boolean {
        const serverTools = frozenTools[serverId];
        if (!serverTools) return false;
        return serverTools.some(tool => tool.name === toolName);
      },
      buildToolCall(serverId: MCPServerId, toolName: string, parameters: Record<string, any> = {}): ToolCall {
        if (!helpers.hasTool(serverId, toolName)) {
          throw new Error(`Unknown tool ${toolName} on server ${serverId}`);
        }
        return {
          serverId,
          toolName,
          parameters
        };
      },
      buildPlan(intent: QueryIntent | string, toolCalls: ToolCall[]): QueryPlan {
        return {
          intent: normalizeIntent(intent),
          tools: toolCalls
        };
      }
    };

    return {
      request: frozenRequest,
      tools: frozenTools,
      helpers,
      console: {
        log: (...args: any[]) => console.debug('[CodeExecutor]', ...args)
      }
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new CodeExecutionError(`Code execution exceeded ${timeout}ms`));
      }, timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }

  private validatePlan(result: any, toolsMap: ToolsMap): QueryPlan {
    if (!result || typeof result !== 'object') {
      throw new CodeExecutionError('Scratchpad returned an invalid plan payload');
    }

    if (!result.intent) {
      throw new CodeExecutionError('Plan is missing intent');
    }

    const intent = normalizeIntent(result.intent);

    if (!Array.isArray(result.tools)) {
      throw new CodeExecutionError('Plan is missing tool list');
    }

    const validatedTools: ToolCall[] = result.tools.map((tool: any) => {
      if (!tool || typeof tool !== 'object') {
        throw new CodeExecutionError('Invalid tool entry in plan');
      }

      const { serverId, toolName, parameters = {} } = tool;

      if (!serverId || !toolName) {
        throw new CodeExecutionError('Tool call must include serverId and toolName');
      }

      const serverTools = toolsMap[serverId as MCPServerId];
      if (!serverTools) {
        throw new CodeExecutionError(`Unknown server referenced in plan: ${serverId}`);
      }

      const exists = serverTools.some(t => t.name === toolName);
      if (!exists) {
        throw new CodeExecutionError(`Unknown tool ${toolName} for server ${serverId}`);
      }

      return {
        serverId: serverId as MCPServerId,
        toolName,
        parameters: parameters && typeof parameters === 'object' ? parameters : {}
      };
    });

    return {
      intent,
      tools: validatedTools
    };
  }
}

function normalizeIntent(intent: QueryIntent | string): QueryIntent {
  if (typeof intent !== 'string') {
    return QueryIntent.UNKNOWN;
  }

  const upperIntent = intent.toUpperCase();
  if (upperIntent in QueryIntent) {
    return QueryIntent[upperIntent as keyof typeof QueryIntent];
  }

  const values = Object.values(QueryIntent) as string[];
  const match = values.find(value => value.toUpperCase() === upperIntent);
  return match ? (match as QueryIntent) : QueryIntent.UNKNOWN;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value as any)) {
      // @ts-ignore
      deepFreeze((value as any)[key]);
    }
  }
  return value;
}

function cloneValue<T>(value: T): T {
  if (typeof (globalThis as any).structuredClone === 'function') {
    return (globalThis as any).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
