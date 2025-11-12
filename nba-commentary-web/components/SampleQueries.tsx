'use client';

import { useEffect, useState } from 'react';
import { generateSampleQueries, LiveGame } from '@/lib/query-generator';

interface SampleQueriesProps {
  onQuerySelect: (query: string) => void;
  visible?: boolean;
}

export default function SampleQueries({ onQuerySelect, visible = true }: SampleQueriesProps) {
  // ⚡ OPTIMIZATION: Start with default queries for instant display (0ms loading!)
  const [queries, setQueries] = useState<string[]>(() => generateSampleQueries([]));
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);

  useEffect(() => {
    async function fetchAndUpgradeQueries() {
      // Only fetch if visible
      if (!visible) return;

      try {
        setIsUpgrading(true);

        // Fetch live games in background (no blocking!)
        const response = await fetch('/api/live-games');

        if (!response.ok) {
          console.warn('[SampleQueries] Failed to fetch live games, keeping default queries');
          return;
        }

        const data = await response.json();
        const games: LiveGame[] = data.games || [];

        // Only upgrade if we got actual game data
        if (games.length > 0) {
          const liveQueries = generateSampleQueries(games);
          setQueries(liveQueries);
          setHasLiveData(true);
          console.log('[SampleQueries] Upgraded to live queries:', games.length, 'games');
        } else {
          console.log('[SampleQueries] No live games, keeping default queries');
        }

      } catch (err) {
        console.warn('[SampleQueries] Error fetching live games, keeping default queries:', err);
        // Keep the default queries - no need to show error to user
      } finally {
        setIsUpgrading(false);
      }
    }

    // Fetch in background - queries already displayed!
    fetchAndUpgradeQueries();
  }, [visible]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Header with optional Live indicator */}
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs text-gray-400 font-medium">
          💡 Try asking:
        </p>
        {hasLiveData && (
          <span className="text-xs text-green-400 flex items-center gap-1 animate-in fade-in duration-500">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" aria-hidden="true" />
            Live
          </span>
        )}
      </div>

      {/* Queries Pills - Always visible */}
      {queries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {queries.map((query, index) => (
            <button
              key={`${query.substring(0, 20)}-${index}`}
              onClick={() => onQuerySelect(query)}
              className="group flex-shrink-0 p-3 rounded-lg border border-blue-400/30 hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 backdrop-blur-md transition-all duration-300 overflow-hidden text-left max-w-xs"
              aria-label={`Ask: ${query}`}
            >
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 transition-all pointer-events-none" />

              {/* Content */}
              <div className="relative">
                <p className="text-xs text-white leading-relaxed line-clamp-3">
                  {query}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty State (rare edge case) */}
      {queries.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">
            No sample queries available
          </p>
        </div>
      )}
    </div>
  );
}
