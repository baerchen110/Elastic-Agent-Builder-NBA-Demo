/**
 * MCP Aggregator - Main orchestration layer
 * Combines Elastic Agent Builder and BallDontLie MCP servers
 */

import { ElasticMCPClient } from './servers/elastic-client.js';
import { BallDontLieMCPClient } from './servers/balldontlie-client.js';
import { NBAMCPClient } from './servers/nba-client.js';
import { SentimentMCPClient } from './servers/sentiment-client.js';
import { MCPCache } from './cache.js';
import { routeQuery } from './router.js';
import { LLMRouter } from './llm-router.js';
import { LLMAdvancedRouter } from './llm-advanced-router.js';
import { routerMetrics } from './router-metrics.js';
import {
  QueryRequest,
  QueryResponse,
  ToolExecutionResult,
  AggregatorStatus,
  MCPServerId,
  MCPTool
} from './types.js';

export interface SentimentToolRunOptions {
  bypassCache?: boolean;
}

export class MCPAggregator {
  private static instance: MCPAggregator | null = null;

  private elasticClient: ElasticMCPClient;
  private ballDontLieClient: BallDontLieMCPClient;
  private nbaClient: NBAMCPClient;
  private sentimentClient: SentimentMCPClient;
  private cache: MCPCache;
  private llmRouter: LLMRouter | null = null;
  private advancedRouter: LLMAdvancedRouter | null = null;
  private startTime: number;
  private useNBAServer: boolean;
  private useLLMRouter: boolean;
  private useAdvancedRouter: boolean;
  private useSentimentServer: boolean;

  private constructor() {
    this.elasticClient = new ElasticMCPClient();
    this.ballDontLieClient = new BallDontLieMCPClient();
    this.nbaClient = new NBAMCPClient();
    this.sentimentClient = new SentimentMCPClient();
    this.cache = new MCPCache({
      maxSize: parseInt(process.env.MCP_CACHE_MAX_SIZE || '500', 10),
      ttl: parseInt(process.env.MCP_CACHE_TTL_MS || '300000', 10)
    });
    this.startTime = Date.now();

    // Feature flags
    this.useNBAServer = process.env.USE_NBA_MCP_SERVER === 'true';
    this.useLLMRouter = process.env.USE_LLM_ROUTER === 'true';
    this.useAdvancedRouter = process.env.USE_LLM_ADVANCED_ROUTER === 'true';
  this.useSentimentServer = process.env.USE_SENTIMENT_MCP_SERVER === 'true';

    // Initialize LLM router if enabled and API key is present
    if (this.useAdvancedRouter) {
      console.log('[Aggregator] Advanced LLM Router feature enabled (experimental)');
    }

    if (this.useSentimentServer) {
      console.log('[Aggregator] Sentiment MCP Server feature enabled');
    }

    if (this.useLLMRouter && !this.useAdvancedRouter) {
      if (process.env.ANTHROPIC_API_KEY) {
        console.log('[Aggregator] LLM Router enabled');
      } else {
        console.warn('[Aggregator] LLM Router enabled but ANTHROPIC_API_KEY not set!');
        this.useLLMRouter = false;
      }
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPAggregator {
    if (!MCPAggregator.instance) {
      MCPAggregator.instance = new MCPAggregator();
    }
    return MCPAggregator.instance;
  }

  async listSentimentTools(): Promise<MCPTool[]> {
    if (!this.useSentimentServer) {
      return [];
    }

    if (!this.sentimentClient.isConnected()) {
      await this.initialize();
    }

    if (!this.sentimentClient.isConnected()) {
      throw new Error('Sentiment MCP server not connected');
    }

    return this.sentimentClient.getTools();
  }

  async executeSentimentTool(
    toolName: string,
    parameters: Record<string, any>,
    options: SentimentToolRunOptions = {}
  ): Promise<ToolExecutionResult> {
    if (!this.useSentimentServer) {
      throw new Error('Sentiment MCP server disabled via feature flag');
    }

    if (!this.sentimentClient.isConnected()) {
      await this.initialize();
    }

    if (!this.sentimentClient.isConnected()) {
      throw new Error('Sentiment MCP server not connected');
    }

    return this.executeToolCall('sentiment', toolName, parameters, options.bypassCache === true);
  }

  /**
   * Initialize all MCP connections
   */
  async initialize(): Promise<void> {
    console.log('[Aggregator] Initializing MCP Aggregator...');
    console.log(`[Aggregator] Using ${this.useNBAServer ? 'NBA MCP Server' : 'BallDontLie'}`);

    try {
      // Connect to Elastic and either NBA or BallDontLie
      const connections = [
        this.elasticClient.connect().catch(error => {
          console.error('[Aggregator] Elastic connection failed:', error.message);
        })
      ];

      if (this.useNBAServer) {
        connections.push(
          this.nbaClient.connect().catch(error => {
            console.error('[Aggregator] NBA MCP connection failed:', error.message);
          })
        );
      } else {
        connections.push(
          this.ballDontLieClient.connect().catch(error => {
            console.error('[Aggregator] BallDontLie connection failed:', error.message);
          })
        );
      }

      if (this.useSentimentServer) {
        connections.push(
          this.sentimentClient.connect().catch(error => {
            console.error('[Aggregator] Sentiment MCP connection failed:', error.message);
          })
        );
      }

      await Promise.all(connections);

      console.log('[Aggregator] Initialization complete!');
      console.log(`[Aggregator] Elastic: ${this.elasticClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      if (this.useNBAServer) {
        console.log(`[Aggregator] NBA MCP: ${this.nbaClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      } else {
        console.log(`[Aggregator] BallDontLie: ${this.ballDontLieClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      }

      if (this.useSentimentServer) {
        console.log(`[Aggregator] Sentiment MCP: ${this.sentimentClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      }

  const toolsMap: Record<string, MCPTool[]> = {};

      if (this.elasticClient.isConnected()) {
        toolsMap.elastic = await this.elasticClient.listTools();
      }

      if (this.useNBAServer && this.nbaClient.isConnected()) {
        toolsMap.nba = await this.nbaClient.listTools();
      } else if (!this.useNBAServer && this.ballDontLieClient.isConnected()) {
        toolsMap.balldontlie = await this.ballDontLieClient.listTools();
      }

      if (this.useSentimentServer && this.sentimentClient.isConnected()) {
        toolsMap.sentiment = await this.sentimentClient.listTools();
      }

      if (this.useAdvancedRouter) {
        this.advancedRouter = new LLMAdvancedRouter(toolsMap);
        console.log('[Aggregator] Advanced LLM Router initialized (delegating to static router)');
      }

      if (!this.useAdvancedRouter && this.useLLMRouter && process.env.ANTHROPIC_API_KEY) {
        this.llmRouter = new LLMRouter(process.env.ANTHROPIC_API_KEY, toolsMap);
        console.log('[Aggregator] LLM Router initialized with available tools');
      }

      if (this.advancedRouter) {
        this.advancedRouter.updateTools(toolsMap);
      }

      if (this.llmRouter) {
        this.llmRouter.updateTools(toolsMap);
      }
    } catch (error) {
      console.error('[Aggregator] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Execute a single tool call with caching
   */
  private async executeToolCall(
    serverId: MCPServerId,
    toolName: string,
    parameters: Record<string, any>,
    bypassCache: boolean = false
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Check cache first unless bypassing
    if (!bypassCache) {
      const cached = this.cache.get(serverId, toolName, parameters);
      if (cached !== undefined) {
        return {
          serverId,
          toolName,
          success: true,
          result: cached,
          cached: true,
          executionTime: Date.now() - startTime
        };
      }
    }

    // Execute the tool
    try {
      let result: any;

      if (serverId === 'elastic' && this.elasticClient.isConnected()) {
        result = await this.elasticClient.callTool(toolName, parameters);
      } else if (serverId === 'nba' && this.nbaClient.isConnected()) {
        result = await this.nbaClient.callTool(toolName, parameters);
      } else if (serverId === 'balldontlie' && this.ballDontLieClient.isConnected()) {
        result = await this.ballDontLieClient.callTool(toolName, parameters);
      } else if (serverId === 'sentiment' && this.sentimentClient.isConnected()) {
        result = await this.sentimentClient.callTool(toolName, parameters);
      } else {
        throw new Error(`Server ${serverId} is not connected`);
      }

      // Cache the result
      if (!bypassCache) {
        this.cache.set(serverId, toolName, parameters, result);
      }

      return {
        serverId,
        toolName,
        success: true,
        result,
        cached: false,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        serverId,
        toolName,
        success: false,
        error: error.message,
        cached: false,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a query across both MCP servers
   */
  async executeQuery(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();

    console.log('[Aggregator] Executing query:', request.query);
    const usingAdvanced = this.useAdvancedRouter && this.advancedRouter;
    const routerLabel = usingAdvanced
      ? 'Advanced LLM Router'
      : this.useLLMRouter && this.llmRouter
        ? 'LLM Router'
        : 'Static Router';
    console.log(`[Aggregator] Using ${routerLabel}`);

    // Route the query to determine intent and tools
    let plan;
    if (usingAdvanced && this.advancedRouter) {
      plan = await this.advancedRouter.routeQuery(request);
    } else if (this.useLLMRouter && this.llmRouter) {
      // Use LLM-powered routing
      plan = await this.llmRouter.routeQuery(request);
    } else {
      // Use static regex-based routing
      plan = routeQuery(request);
    }

    console.log('[Aggregator] Query plan:', JSON.stringify(plan, null, 2));

    if (!usingAdvanced) {
      routerMetrics.logPlan({
        request,
        plan,
        router: routerLabel,
        source: this.useLLMRouter && this.llmRouter ? 'classic-llm' : 'static',
        scratchpad: undefined,
        executionSucceeded: true,
        warnings: [],
        usedFallback: false
      });
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      plan.tools.map(tool =>
        this.executeToolCall(tool.serverId, tool.toolName, tool.parameters)
      )
    );

    // Organize results by server
    const results: Record<MCPServerId, any> = {
      elastic: null,
      nba: null,
      balldontlie: null,
      sentiment: null
    };

    for (const toolResult of toolResults) {
      if (toolResult.success) {
        if (!results[toolResult.serverId]) {
          results[toolResult.serverId] = [];
        }
        results[toolResult.serverId].push(toolResult.result);
      }
    }

    // Collect tool names used
    const toolsUsed = toolResults.map(tr => `${tr.serverId}:${tr.toolName}`);

    // Check if any results were cached
    const cached = toolResults.some(tr => tr.cached);

    return {
      intent: plan.intent,
      results,
      toolsUsed,
      cached,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get aggregator status
   */
  getStatus(): AggregatorStatus {
    const servers: any = {
      elastic: {
        id: 'elastic',
        connected: this.elasticClient.isConnected(),
        tools: this.elasticClient.isConnected()
          ? this.elasticClient.getToolNames().map(name => ({
              name,
              description: '',
              inputSchema: { type: 'object', properties: {} }
            }))
          : []
      }
    };

    // Add the active NBA server (either NBA MCP or BallDontLie)
    if (this.useNBAServer) {
      servers.nba = {
        id: 'nba',
        connected: this.nbaClient.isConnected(),
        tools: this.nbaClient.isConnected()
          ? this.nbaClient.getToolNames().map(name => ({
              name,
              description: '',
              inputSchema: { type: 'object', properties: {} }
            }))
          : []
      };
    } else {
      servers.balldontlie = {
        id: 'balldontlie',
        connected: this.ballDontLieClient.isConnected(),
        tools: this.ballDontLieClient.isConnected()
          ? this.ballDontLieClient.getToolNames().map(name => ({
              name,
              description: '',
              inputSchema: { type: 'object', properties: {} }
            }))
          : []
      };
    }

    servers.sentiment = {
      id: 'sentiment',
      connected: this.useSentimentServer ? this.sentimentClient.isConnected() : false,
      tools: this.useSentimentServer && this.sentimentClient.isConnected()
        ? this.sentimentClient.getToolNames().map(name => ({
            name,
            description: '',
            inputSchema: { type: 'object', properties: {} }
          }))
        : []
    };

    return {
      servers,
      cacheStats: this.cache.getStats(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Disconnect all clients
   */
  async disconnect(): Promise<void> {
    console.log('[Aggregator] Disconnecting...');
    const disconnects = [this.elasticClient.disconnect()];

    if (this.useNBAServer) {
      disconnects.push(this.nbaClient.disconnect());
    } else {
      disconnects.push(this.ballDontLieClient.disconnect());
    }

    if (this.useSentimentServer) {
      disconnects.push(this.sentimentClient.disconnect());
    }

    await Promise.all(disconnects);
    console.log('[Aggregator] Disconnected');
  }
}

// Export singleton instance getter
export function getAggregator(): MCPAggregator {
  return MCPAggregator.getInstance();
}
