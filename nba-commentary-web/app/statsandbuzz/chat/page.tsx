'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import SampleQueries from '@/components/SampleQueries';
import MessageBubble from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';
import { Message } from '@/lib/types';

export default function StatsAndBuzzChatPage() {
  const router = useRouter();
  const [showSampleQueries, setShowSampleQueries] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Hide sample queries after first message
    setShowSampleQueries(false);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call MCP API
      const response = await fetch('/api/mcp/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: content,
          summarize: true
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get response');
      }

      // Create assistant message from response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.data.summary || formatResults(result.data.results),
        timestamp: new Date().toISOString(),
        status: 'sent',
        tools_used: result.data.toolsUsed || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
        status: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format raw results if no summary available
  const formatResults = (results: unknown): string => {
    if (!results) return 'No results found.';

    if (typeof results === 'string') return results;

    try {
      return JSON.stringify(results, null, 2);
    } catch {
      return 'Unable to format results.';
    }
  };

  const handleQuerySelect = (query: string) => {
    handleSendMessage(query);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header - Fixed */}
      <header className="relative z-10 backdrop-blur-md bg-gradient-to-r from-blue-600/40 to-indigo-600/40 border-b border-blue-400/20 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            {/* Back Button */}
            <button
              onClick={() => router.push('/')}
              className="text-blue-300 hover:text-blue-200 transition-colors text-xl sm:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
              aria-label="Back to home"
              type="button"
            >
              ←
            </button>

            {/* Title Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-3xl sm:text-4xl" aria-hidden="true">🏀💬</div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                Stats and Buzz
              </h1>
            </div>
          </div>
          <p className="text-blue-100 text-xs sm:text-sm font-medium ml-8 sm:ml-12 md:ml-14">
            Ask questions about player stats and fan sentiment
          </p>
        </div>
      </header>

      {/* Messages Area - Scrollable */}
      <main
        className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full custom-scrollbar"
        role="main"
        aria-label="Chat messages"
      >
        {/* Empty State (when no messages) */}
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg px-4">
              {/* Floating Basketball Animation */}
              <div className="mb-8 flex justify-center" aria-hidden="true">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full animate-spin opacity-75" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-5xl">🏀</span>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight">
                Welcome to
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
                  Stats and Buzz
                </span>
              </h2>
              <p className="text-sm sm:text-base text-gray-300 mb-8 leading-relaxed">
                Ask me anything about NBA player statistics, performance trends, and fan sentiment analysis!
              </p>

              {/* Dynamic Sample Queries */}
              <SampleQueries
                onQuerySelect={handleQuerySelect}
                visible={showSampleQueries}
              />

              {/* Info Card */}
              <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur-md border border-blue-400/20 rounded-lg p-4 text-left">
                <p className="text-xs text-gray-300">
                  <span className="font-bold text-blue-300">💡 Tips:</span> Ask about player performance metrics, compare statistics, analyze fan sentiment, or explore trending topics in the NBA community.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Display (when messages exist) */}
        {messages.length > 0 && (
          <div className="space-y-4 sm:space-y-6" role="log" aria-live="polite" aria-atomic="false">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <MessageBubble
                  message={message}
                  isStreaming={index === messages.length - 1 && isLoading && message.role === 'assistant'}
                />
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div
                className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                role="status"
                aria-label="AI is thinking"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg bg-gradient-to-br from-blue-400 to-cyan-400 animate-pulse">
                  <span className="text-lg" aria-hidden="true">🤖</span>
                </div>
                <div className="max-w-2xl">
                  <div className="px-5 py-3 rounded-2xl backdrop-blur-md border border-blue-400/20 bg-gradient-to-br from-slate-700/60 to-slate-800/60">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>Thinking</span>
                      <span className="inline-flex gap-0.5" aria-hidden="true">
                        <span className="animate-bounce">•</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>•</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>•</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </main>

      {/* Input Area - Fixed */}
      <footer
        className="relative z-10 backdrop-blur-md bg-gradient-to-t from-slate-900/80 to-slate-900/40 border-t border-blue-400/20 p-4 sm:p-6 shadow-2xl"
        role="contentinfo"
        aria-label="Chat input"
      >
        <div className="max-w-4xl mx-auto">
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
          />

          {/* Helper Text */}
          <p className="mt-2 sm:mt-3 text-xs text-center text-gray-400">
            <span className="hidden sm:inline">Press Enter to send • Shift+Enter for new line • </span>
            <span className="sm:hidden">Tap send or press Enter • </span>
            Powered by Elastic Agent Builder & Claude AI
          </p>
        </div>
      </footer>
    </div>
  );
}
