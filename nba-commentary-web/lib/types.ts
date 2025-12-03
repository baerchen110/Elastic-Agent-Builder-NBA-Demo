export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface WebSocketMessage {
  type: 'query' | 'response' | 'status' | 'error' | 'clear' | 'cleared';
  content?: string;
  tools_used?: string[];
  timestamp?: string;
  success?: boolean;
}

export type StreamingServerMessage =
  | {
      type: 'status';
      timestamp?: string;
    }
  | {
      type: 'chunk';
      content: string;
      fullContent: string;
      tools_used?: string[];
      timestamp?: string;
    }
  | {
      type: 'complete';
      content: string;
      success?: boolean;
      tools_used?: string[];
      timestamp?: string;
    }
  | {
      type: 'response';
      content?: string;
      tools_used?: string[];
      timestamp?: string;
      success?: boolean;
    }
  | {
      type: 'error';
      content: string;
      timestamp?: string;
    }
  | {
      type: 'cleared';
      timestamp?: string;
    };

export interface ToolSummary {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface AggregatorServerSnapshot {
  connected: boolean;
  tools?: ToolSummary[];
  toolCount?: number;
}

export interface AggregatorStatusSnapshot {
  servers: Partial<Record<'elastic' | 'nba' | 'balldontlie' | 'sentiment', AggregatorServerSnapshot>>;
  cacheStats: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  uptime: number;
}

export type HealthStatusValue = 'ok' | 'healthy' | 'degraded' | 'unhealthy' | 'error';

export interface HealthResponse {
  status: HealthStatusValue;
  timestamp: string;
  servers: {
    elastic: AggregatorServerSnapshot;
    nba?: AggregatorServerSnapshot;
    balldontlie?: AggregatorServerSnapshot;
    sentiment?: AggregatorServerSnapshot;
  };
  cache: AggregatorStatusSnapshot['cacheStats'];
  uptime: number;
  error?: string;
}

export interface QueryExecutionData {
  intent: string;
  toolsUsed: string[];
  cached: boolean;
  executionTime: number;
  results: unknown;
  summary?: string;
  summaryError?: string;
}

export interface QueryExecutionResponse {
  success: boolean;
  data?: QueryExecutionData;
  error?: string;
}

export interface SentimentToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { description?: string; enum?: string[] }>;
    required?: string[];
  };
  [key: string]: unknown;
}

export interface SentimentStatusResponse {
  success: boolean;
  connected: boolean;
  tools: SentimentToolDefinition[];
  cache?: AggregatorStatusSnapshot['cacheStats'];
  error?: string;
}

export interface SentimentExecutionResult {
  success: boolean;
  cached?: boolean;
  executionTime?: number;
  result?: unknown;
  error?: string | null;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
}
