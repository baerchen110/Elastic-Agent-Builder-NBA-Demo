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
