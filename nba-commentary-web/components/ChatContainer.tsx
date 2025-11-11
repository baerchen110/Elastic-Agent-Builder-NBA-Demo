'use client';

import { useRef, useEffect } from 'react';
import Image from 'next/image';
import { useChat } from '@/hooks/useChat';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import LoadingIndicator from './LoadingIndicator';
import { cn } from '@/lib/utils';

export default function ChatContainer() {
    const {
        messages,
        isLoading,
        error,
        connectionStatus,
        sendMessage,
        clearChat
    } = useChat();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isConnected = connectionStatus === 'connected';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
            </div>

            {/* Header */}
            <div className="relative z-10 backdrop-blur-md bg-gradient-to-r from-blue-600/40 to-indigo-600/40 border-b border-blue-400/20 shadow-2xl">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Image
                                    src="https://upload.wikimedia.org/wikipedia/en/0/03/National_Basketball_Association_logo.svg"
                                    alt="NBA Logo"
                                    width={48}
                                    height={48}
                                    className="drop-shadow-lg"
                                />
                                <h1 className="text-4xl font-black text-white tracking-tight">
                                    NBA<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300"> Commentary Companion</span>
                                </h1>
                            </div>
                            <p className="text-blue-100 text-sm font-medium">
                                Real-time analytics powered by Elastic Agent Builder
                            </p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                            <div className={cn(
                                'w-3 h-3 rounded-full animate-pulse',
                                isConnected ? 'bg-emerald-400' : 'bg-red-400'
                            )} />
                            <span className="text-xs font-semibold text-white">
                                {connectionStatus === 'connecting' && '⏳ Connecting'}
                                {connectionStatus === 'connected' && '✨ Connected'}
                                {connectionStatus === 'disconnected' && '⚠️ Offline'}
                                {connectionStatus === 'error' && '❌ Error'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {messages.length === 0 && !isLoading && (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center max-w-lg">
                                {/* Floating Basketball Animation */}
                                <div className="mb-8 flex justify-center">
                                    <div className="relative w-24 h-24">
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full animate-spin opacity-75" style={{ animationDuration: '3s' }} />
                                        <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                                            <span className="text-5xl">🏀</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-gray-300 mb-8 leading-relaxed">
                                    Ask about player stats, game predictions, matchup analysis, and real-time insights powered by advanced AI and real NBA data.
                                </p>

                                {/* Quick Action Buttons */}
                                <div className="grid grid-cols-2 gap-3 mb-8">
                                    {[
                                        { icon: '📊', text: 'Top players', query: 'Who are the hottest players in the NBA right now based on last 30 days of play? \n' +
                                                'Show me players in "Hot" form and their recent scoring efficiency. \n' +
                                                'Which teams have the most players in hot form?' },
                                        { icon: '🎮', text: 'Games', query: 'What games are happening today?' },
                                        { icon: '⚖️', text: 'Compare', query: 'I want to understand generational differences. \n' +
                                                'Compare Victor Wembanyama and Stephen Curry. \n' +
                                                'Show me their career stage classifications and how experience impact differs.' },
                                        { icon: '🔮', text: 'Predict', query: 'Where do all NBA teams stand in the playoff race right now? Show me teams projected to finish in the top 4 seeds and their current playoff probability. Which teams are on the bubble?' },
                                    ].map((btn, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(btn.query)}
                                            disabled={!isConnected}
                                            className="group relative p-4 rounded-lg border border-blue-400/30 hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 backdrop-blur-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 transition-all" />
                                            <div className="relative">
                                                <div className="text-2xl mb-1">{btn.icon}</div>
                                                <div className="text-xs font-bold text-white">{btn.text}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Info Cards */}
                                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur-md border border-blue-400/20 rounded-lg p-4 text-left">
                                    <p className="text-xs text-gray-300">
                                        <span className="font-bold text-blue-300">💡 Tips:</span> Ask about player performance, game predictions, statistical comparisons, and real-time game analysis.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isStreaming={index === messages.length - 1 && isLoading && message.role === 'assistant'}
                        />
                    ))}


                    {isLoading && <LoadingIndicator />}

                    {error && (
                        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-md border border-red-400/30 rounded-lg p-4 max-w-md mx-auto">
                            <p className="text-sm font-bold text-red-200">⚠️ Error</p>
                            <p className="text-xs text-red-100 mt-1">{error}</p>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="relative backdrop-blur-md bg-gradient-to-t from-slate-900/80 to-slate-900/40 border-t border-blue-400/20 p-6 shadow-2xl">
                    <div className="max-w-4xl mx-auto">
                        <ChatInput
                            onSend={sendMessage}
                            disabled={!isConnected || isLoading}
                        />

                        {!isConnected && (
                            <div className="mt-3 p-3 bg-red-500/20 backdrop-blur-md border border-red-400/30 rounded-lg">
                                <p className="text-xs text-red-200 font-semibold">
                                    ⚠️ Connection lost. Make sure backend is running on port 3001.
                                </p>
                            </div>
                        )}

                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="mt-3 text-xs text-gray-400 hover:text-blue-300 transition underline hover:underline-offset-2"
                            >
                                Clear conversation
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}