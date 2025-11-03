'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-3 items-end">
      {/* Input Container */}
      <div className={cn(
        'flex-1 relative rounded-2xl border transition-all duration-300',
        isFocused
          ? 'border-blue-400/60 bg-gradient-to-br from-slate-800/80 to-slate-800/60 shadow-lg shadow-blue-500/20'
          : 'border-blue-400/20 bg-gradient-to-br from-slate-800/60 to-slate-800/40',
        disabled && 'opacity-50 cursor-not-allowed'
      )}>
        {/* Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask me anything about NBA... (Shift+Enter for new line)"
          disabled={disabled}
          className={cn(
            'w-full px-5 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none font-medium',
            disabled && 'cursor-not-allowed'
          )}
          rows={1}
        />
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        type="button"
        className={cn(
          'p-3 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center flex-shrink-0 border',
          disabled || !input.trim()
            ? 'bg-slate-700/50 text-gray-500 border-slate-600/50 cursor-not-allowed'
            : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400/50 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95'
        )}
      >
        {disabled ? '⏳' : '✈️'}
      </button>
    </div>
  );
}
