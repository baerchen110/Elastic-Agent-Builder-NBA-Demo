'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatState } from '@/lib/types';
import { generateId } from '@/lib/utils';

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    connectionStatus: 'connecting'
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const currentStreamingMessageRef = useRef<string>('');

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsUrl = `ws://localhost:3001`;
        console.log('🔗 Connecting to WebSocket:', wsUrl);

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('✅ WebSocket Connected');
          setState(prev => ({
            ...prev,
            connectionStatus: 'connected',
            error: null
          }));
        };

        wsRef.current.onmessage = (event) => {
          console.log('📨 Received message:', event.data);
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        };

        wsRef.current.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          setState(prev => ({
            ...prev,
            connectionStatus: 'error',
            error: 'Connection error'
          }));
        };

        wsRef.current.onclose = () => {
          console.log('❌ WebSocket Disconnected');
          setState(prev => ({
            ...prev,
            connectionStatus: 'disconnected'
          }));
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error('Connection error:', error);
        setState(prev => ({
          ...prev,
          connectionStatus: 'error',
          error: 'Failed to connect'
        }));
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleServerMessage = useCallback((data: any) => {
    console.log('📋 Message type:', data.type);

    if (data.type === 'status') {
      console.log('⏳ Status message');
      setState(prev => ({
        ...prev,
        isLoading: true
      }));
    } else if (data.type === 'chunk') {
      // ===== STREAMING: Update message with chunk =====
      console.log('📦 Chunk received:', data.content);
      currentStreamingMessageRef.current = data.fullContent;

      setState(prev => {
        const messages = [...prev.messages];
        const lastMessage = messages[messages.length - 1];

        // Update or create streaming message
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.status !== 'sent') {
          // Update existing streaming message
          lastMessage.content = data.fullContent;
        } else {
          // Create new streaming message
          const streamingMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: data.fullContent,
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'sending'
          };
          messages.push(streamingMessage);
        }

        return {
          ...prev,
          messages,
          isLoading: true
        };
      });
    } else if (data.type === 'complete') {
      // ===== STREAMING: Complete message =====
      console.log('✨ Stream complete');
      const message: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.content,
        tools_used: data.tools_used,
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.success ? 'sent' : 'error'
      };

      setState(prev => {
        const messages = [...prev.messages];
        const lastMessage = messages[messages.length - 1];

        // Replace streaming message or add new one
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.status === 'sending') {
          messages[messages.length - 1] = message;
        } else {
          messages.push(message);
        }

        return {
          ...prev,
          messages,
          isLoading: false,
          error: null
        };
      });

      currentStreamingMessageRef.current = '';
    } else if (data.type === 'response') {
      // Fallback for non-streaming response
      console.log('✨ Response received:', data);
      const message: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.content || 'No content',
        tools_used: data.tools_used,
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.success ? 'sent' : 'error'
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message],
        isLoading: false,
        error: null
      }));
    } else if (data.type === 'error') {
      console.error('❌ Error:', data.content);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.content
      }));
    } else if (data.type === 'cleared') {
      console.log('🗑️ Chat cleared');
      setState(prev => ({
        ...prev,
        messages: []
      }));
    }
  }, []);

  const sendMessage = useCallback((query: string) => {
    console.log('📤 Sending message:', query);

    if (!query.trim() || state.connectionStatus !== 'connected') {
      console.warn('Cannot send: not connected or empty query');
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true
    }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        type: 'query',
        query
      });
      console.log('📡 Sending WebSocket payload:', payload);
      wsRef.current.send(payload);
    } else {
      console.error('WebSocket not open. State:', wsRef.current?.readyState);
    }
  }, [state.connectionStatus]);

  const clearChat = useCallback(() => {
    console.log('🗑️ Clearing chat');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  }, []);

  return {
    ...state,
    sendMessage,
    clearChat
  };
}
