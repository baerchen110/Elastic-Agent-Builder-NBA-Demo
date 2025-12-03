'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface StatsAndBuzzTileProps {
  href?: string;
  className?: string;
  children?: ReactNode;
}

export default function StatsAndBuzzTile({
  href = '/chat',
  className = '',
  children
}: StatsAndBuzzTileProps) {
  return (
    <Link
      href={href}
      className={`group relative p-4 rounded-lg border border-blue-400/30
        hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 to-indigo-500/10
        hover:from-blue-500/20 hover:to-indigo-500/20 backdrop-blur-md
        transition-all duration-300 overflow-hidden block ${className}`}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-cyan-500/0
        group-hover:from-blue-500/10 group-hover:to-cyan-500/10 transition-all" />

      {/* Content */}
      {children || (
        <div className="relative">
          {/* Icon */}
          <div className="text-2xl mb-2">🏀💬</div>

          {/* Title */}
          <h3 className="text-sm font-bold text-white mb-1">
            Stats and Buzz
          </h3>

          {/* Subtitle */}
          <p className="text-xs text-gray-300 leading-relaxed">
            Ask questions about player stats and fan sentiment
          </p>
        </div>
      )}
    </Link>
  );
}
