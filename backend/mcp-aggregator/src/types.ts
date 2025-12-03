/**
 * Type definitions for MCP Aggregator
 */

// Query Intent Types
export enum QueryIntent {
  PLAYER_SEARCH = 'PLAYER_SEARCH',
  PLAYER_STATS = 'PLAYER_STATS',
  LIVE_GAMES = 'LIVE_GAMES',
  ANALYTICS = 'ANALYTICS',
  SENTIMENT = 'SENTIMENT',
  TEAM_INFO = 'TEAM_INFO',
  UNKNOWN = 'UNKNOWN'
}

// MCP Server Identifiers
export type MCPServerId = 'elastic' | 'nba' | 'balldontlie' | 'sentiment'; // keeping balldontlie for backward compatibility

// Tool Execution Plan
export interface ToolCall {
  serverId: MCPServerId;
  toolName: string;
  parameters: Record<string, any>;
}

export interface QueryPlan {
  intent: QueryIntent;
  tools: ToolCall[];
  playerNames?: string[];
}

// Query Request/Response
export interface QueryRequest {
  query: string;
  filters?: Record<string, any>;
}

export interface QueryResponse {
  intent: QueryIntent;
  results: Record<MCPServerId, any>;
  toolsUsed: string[];
  cached: boolean;
  executionTime: number;
}

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  metadata?: {
    labels?: string[];
    categories?: string[];
    synopsis?: string;
    summary?: string;
    expertise?: string[];
    [key: string]: any;
  };
  categories?: string[];
  labels?: string[];
}

// MCP Server Interface
export interface MCPServerConnection {
  id: MCPServerId;
  connected: boolean;
  tools: MCPTool[];
  lastError?: string;
}

// Tool Execution Result
export interface ToolExecutionResult {
  serverId: MCPServerId;
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  cached: boolean;
  executionTime: number;
}

// Cache Configuration
export interface CacheConfig {
  maxSize: number;
  ttl: number; // in milliseconds
}

// Aggregator Status
export interface AggregatorStatus {
  servers: Record<MCPServerId, MCPServerConnection>;
  cacheStats: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  uptime: number;
}
