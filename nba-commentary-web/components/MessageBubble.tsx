'use client';

import { Message } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {/* Avatar */}
      {!isUser && (
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg',
          isStreaming
            ? 'bg-gradient-to-br from-blue-400 to-cyan-400 animate-pulse'
            : 'bg-gradient-to-br from-blue-400 to-cyan-400'
        )}>
          <span className="text-lg">🤖</span>
        </div>
      )}

      {/* Message Bubble */}
      <div className={cn(
        'max-w-2xl group',
        isUser && 'flex justify-end'
      )}>
        <div className={cn(
          'px-5 py-3 rounded-2xl backdrop-blur-md border transition-all duration-200 hover:shadow-lg',
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-400/50 text-white rounded-br-md shadow-lg'
            : 'bg-gradient-to-br from-slate-700/60 to-slate-800/60 border-blue-400/20 text-gray-100 rounded-bl-md hover:border-blue-400/40',
          isStreaming && 'border-blue-400/60'
        )}>
          {/* Main Content */}
          <div className={cn(
            'text-sm leading-relaxed font-medium prose prose-invert max-w-none',
            isUser ? 'text-blue-50' : 'text-gray-200'
          )}>
            {message.content ? (
              <ReactMarkdown
                components={{
                  h1: ({ ...props }) => (
                    <h1 className="text-lg font-bold mt-3 mb-2 text-blue-300" {...props} />
                  ),
                  h2: ({ ...props }) => (
                    <h2 className="text-base font-bold mt-2 mb-1 text-blue-200" {...props} />
                  ),
                  h3: ({ ...props }) => (
                    <h3 className="text-sm font-bold mt-2 mb-1 text-blue-100" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="mb-2" {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul className="list-disc list-inside mb-2 space-y-1" {...props} />
                  ),
                  ol: ({ ...props }) => (
                    <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
                  ),
                  li: ({ ...props }) => (
                    <li className="text-sm" {...props} />
                  ),
                  strong: ({ ...props }) => (
                    <strong className="font-bold text-blue-200" {...props} />
                  ),
                  em: ({ ...props }) => (
                    <em className="italic text-blue-100" {...props} />
                  ),
                  code: ({ ...props }) => (
                    <code className="bg-black/30 px-2 py-1 rounded text-xs font-mono" {...props} />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote className="border-l-4 border-blue-400 pl-3 italic my-2" {...props} />
                  ),
                  table: ({ ...props }) => (
                    <table className="w-full border-collapse my-2" {...props} />
                  ),
                  th: ({ ...props }) => (
                    <th className="border border-gray-500 px-2 py-1 text-left" {...props} />
                  ),
                  td: ({ ...props }) => (
                    <td className="border border-gray-500 px-2 py-1" {...props} />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <span className="text-gray-400">Waiting for response...</span>
            )}
          </div>

          {/* ===== STREAMING INDICATOR ===== */}
          {isStreaming && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-300 font-medium">
              <span>Streaming</span>
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>•</span>
              </span>
            </div>
          )}

          {/* Tools Used Badge */}
          {message.tools_used && message.tools_used.length > 0 && !isStreaming && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className={cn(
                'text-xs font-bold mb-2',
                isUser ? 'text-blue-100' : 'text-gray-400'
              )}>
                🔧 Tools:
              </p>
              <div className="flex flex-wrap gap-2">
                {message.tools_used.map(tool => (
                  <span
                    key={tool}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                      isUser
                        ? 'bg-blue-500/40 text-blue-100'
                        : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                    )}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className={cn(
            'text-xs mt-2 opacity-70 font-medium',
            isUser ? 'text-blue-100' : 'text-gray-500'
          )}>
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-lg">👤</span>
        </div>
      )}
    </div>
  );
}