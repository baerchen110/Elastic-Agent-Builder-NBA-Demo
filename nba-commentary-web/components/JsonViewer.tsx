'use client';

import { useState, type ReactNode } from 'react';

interface JsonViewerProps {
  data: unknown;
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export default function JsonViewer({
  data,
  title,
  collapsible = true,
  defaultExpanded = true
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const jsonString = data !== undefined && data !== null
    ? JSON.stringify(data, null, 2)
    : '';

  const handleCopy = async () => {
    if (!jsonString) return;

    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!jsonString) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50">
        {title && (
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
          </div>
        )}
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">No data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          {collapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {title && <h3 className="text-sm font-semibold text-slate-300">{title}</h3>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {jsonString.split('\n').length} lines
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-700 hover:text-white active:scale-95"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* JSON Content */}
      {expanded && (
        <div className="relative max-h-[600px] overflow-auto">
          <pre className="p-4 text-sm leading-relaxed">
            <code className="font-mono">
              {highlightJson(jsonString)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

// JSON syntax highlighting
function highlightJson(json: string): ReactNode {
  const lines = json.split('\n');

  return lines.map((line, lineIndex) => {
    const parts: ReactNode[] = [];
    let currentIndex = 0;

    // Regex patterns for different JSON elements
    const patterns = [
      // String keys (in quotes before colon)
      { regex: /"([^"]+)"(\s*):/g, className: 'text-sky-400' },
      // String values
      { regex: /:\s*"([^"]*)"/g, className: 'text-emerald-400' },
      // Numbers
      { regex: /:\s*(-?\d+\.?\d*)/g, className: 'text-amber-400' },
      // Booleans
      { regex: /:\s*(true|false)/g, className: 'text-purple-400' },
      // Null
      { regex: /:\s*(null)/g, className: 'text-slate-500' },
    ];

    // Helper to add highlighted or plain text
    const addPart = (text: string, className?: string) => {
      if (text) {
        parts.push(
          <span key={`${lineIndex}-${parts.length}`} className={className}>
            {text}
          </span>
        );
      }
    };

    // Process each character, applying highlighting
    const processedLine = line.replace(/"([^"]+)"(\s*):/g, (match, key, space) => {
      return `§KEY§${key}§KEYEND§${space}:`;
    }).replace(/:\s*"([^"]*)"/g, (match, value) => {
      return `: §STR§${value}§STREND§`;
    }).replace(/:\s*(-?\d+\.?\d*)/g, (match, num) => {
      return `: §NUM§${num}§NUMEND§`;
    }).replace(/:\s*(true|false)/g, (match, bool) => {
      return `: §BOOL§${bool}§BOOLEND§`;
    }).replace(/:\s*(null)/g, `: §NULL§null§NULLEND§`);

    const segments = processedLine.split(/(§[A-Z]+§|§[A-Z]+END§)/);
    let currentClassName: string | undefined;

    segments.forEach((segment, i) => {
      if (segment === '§KEY§') {
        currentClassName = 'text-sky-400 font-semibold';
      } else if (segment === '§STR§') {
        currentClassName = 'text-emerald-400';
      } else if (segment === '§NUM§') {
        currentClassName = 'text-amber-400';
      } else if (segment === '§BOOL§') {
        currentClassName = 'text-purple-400';
      } else if (segment === '§NULL§') {
        currentClassName = 'text-slate-500';
      } else if (segment.endsWith('END§')) {
        currentClassName = undefined;
      } else if (segment) {
        addPart(segment, currentClassName || 'text-slate-300');
      }
    });

    return (
      <div key={lineIndex} className="hover:bg-slate-700/30 transition-colors">
        {parts.length > 0 ? parts : <span className="text-slate-300">{line}</span>}
      </div>
    );
  });
}
