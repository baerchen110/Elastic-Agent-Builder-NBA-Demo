'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { extractErrorMessage } from '@/lib/api';
import type {
  SentimentExecutionResult,
  SentimentStatusResponse,
  SentimentToolDefinition
} from '@/lib/types';

type ToolFormValues = {
  player_name?: string;
  timeframe?: string;
  limit?: number | string;
  subreddits?: string;
  sources?: Record<string, boolean>;
  compare_periods?: string;
  sensitivity?: string;
  player1_name?: string;
  player2_name?: string;
} & Record<string, unknown>;

const TOOL_DEFAULTS: Record<string, ToolFormValues> = {
  get_twitter_player_sentiment: {
    player_name: 'LeBron James',
    timeframe: '24h',
    limit: 200
  },
  get_reddit_player_sentiment: {
    player_name: 'LeBron James',
    subreddits: 'nba',
    timeframe: '7d',
    limit: 200
  },
  get_combined_player_sentiment: {
    player_name: 'LeBron James',
    timeframe: '7d',
    limit: 200,
    sources: {
      twitter: true,
      reddit: true,
      narrative: false
    }
  },
  analyze_player_narrative_trend: {
    player_name: 'LeBron James',
    compare_periods: '30d,7d,24h'
  },
  detect_narrative_shift: {
    player_name: 'LeBron James',
    sensitivity: 'medium'
  },
  compare_players_sentiment: {
    player1_name: 'LeBron James',
    player2_name: 'Stephen Curry',
    timeframe: '7d'
  }
};

const TIMEFRAME_OPTIONS = ['24h', '7d', '30d', 'all'];
const SENSITIVITY_OPTIONS = ['low', 'medium', 'high'];

function toArray(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cloneDefaults(toolName: string): ToolFormValues {
  const defaults = TOOL_DEFAULTS[toolName];
  if (!defaults) {
    return {};
  }

  return {
    ...defaults,
    sources: defaults.sources ? { ...defaults.sources } : undefined
  };
}

function parseNumeric(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (typeof value === 'string') {
        return value.trim() !== '';
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return true;
    })
  );
}

export default function SentimentTester() {
  const [status, setStatus] = useState<SentimentStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string>('get_combined_player_sentiment');
  const [formValues, setFormValues] = useState<ToolFormValues>(cloneDefaults('get_combined_player_sentiment'));
  const [bypassCache, setBypassCache] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [execution, setExecution] = useState<SentimentExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setErrorMessage(null);
    try {
      const response = await axios.get<SentimentStatusResponse>('/api/mcp/sentiment');
      setStatus(response.data);
      if (!selectedTool && response.data.tools.length > 0) {
        const first = response.data.tools[0].name;
        setSelectedTool(first);
        setFormValues(cloneDefaults(first));
      }
    } catch (error: unknown) {
      const message = extractErrorMessage(error, 'Failed to load sentiment status');
      setStatus({ success: false, connected: false, tools: [], error: message });
      setErrorMessage(message);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus().catch((err) => console.error('Failed to fetch sentiment status', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toolMeta = useMemo<SentimentToolDefinition | undefined>(() => {
    if (!status?.tools) return undefined;
    return status.tools.find((tool) => tool.name === selectedTool);
  }, [status, selectedTool]);

  const resetForm = (toolName: string) => {
    setFormValues(cloneDefaults(toolName));
    setExecution(null);
    setLastPayload(null);
  };

  const handleToolChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const toolName = event.target.value;
    setSelectedTool(toolName);
    resetForm(toolName);
  };

  const handleInputChange = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = useCallback((): Record<string, unknown> => {
    switch (selectedTool) {
      case 'get_twitter_player_sentiment':
        return compactRecord({
          player_name: typeof formValues.player_name === 'string' ? formValues.player_name.trim() : undefined,
          timeframe: typeof formValues.timeframe === 'string' && formValues.timeframe !== '' ? formValues.timeframe : undefined,
          limit: parseNumeric(formValues.limit)
        });
      case 'get_reddit_player_sentiment':
        return compactRecord({
          player_name: typeof formValues.player_name === 'string' ? formValues.player_name.trim() : undefined,
          subreddits:
            typeof formValues.subreddits === 'string' && formValues.subreddits !== ''
              ? toArray(formValues.subreddits)
              : undefined,
          timeframe: typeof formValues.timeframe === 'string' && formValues.timeframe !== '' ? formValues.timeframe : undefined,
          limit: parseNumeric(formValues.limit)
        });
      case 'get_combined_player_sentiment': {
        const sources = formValues.sources || {};
        const selectedSources = Object.entries(sources)
          .filter(([, checked]) => checked)
          .map(([key]) => key);

        return compactRecord({
          player_name: typeof formValues.player_name === 'string' ? formValues.player_name.trim() : undefined,
          timeframe: typeof formValues.timeframe === 'string' && formValues.timeframe !== '' ? formValues.timeframe : undefined,
          limit: parseNumeric(formValues.limit),
          sources: selectedSources.length > 0 ? selectedSources : undefined
        });
      }
      case 'analyze_player_narrative_trend':
        return compactRecord({
          player_name: typeof formValues.player_name === 'string' ? formValues.player_name.trim() : undefined,
          compare_periods:
            typeof formValues.compare_periods === 'string' && formValues.compare_periods !== ''
              ? toArray(formValues.compare_periods)
              : undefined
        });
      case 'detect_narrative_shift':
        return compactRecord({
          player_name: typeof formValues.player_name === 'string' ? formValues.player_name.trim() : undefined,
          sensitivity:
            typeof formValues.sensitivity === 'string' && formValues.sensitivity !== ''
              ? formValues.sensitivity
              : 'medium'
        });
      case 'compare_players_sentiment':
        return compactRecord({
          player1_name: typeof formValues.player1_name === 'string' ? formValues.player1_name.trim() : undefined,
          player2_name: typeof formValues.player2_name === 'string' ? formValues.player2_name.trim() : undefined,
          timeframe: typeof formValues.timeframe === 'string' && formValues.timeframe !== '' ? formValues.timeframe : undefined
        });
      default:
        return compactRecord({ ...formValues });
    }
  }, [formValues, selectedTool]);

  const responsePreview = useMemo(() => {
    if (!execution) {
      return null;
    }

    if (execution.success) {
      return execution.result ?? {};
    }

    return { error: execution.error ?? 'Unknown error' };
  }, [execution]);

  const runTool = async () => {
    if (!selectedTool) return;
    const payload = buildPayload();

    if (Object.keys(payload).length === 0) {
      setErrorMessage('Please provide at least one parameter for the selected tool.');
      return;
    }

    setLastPayload(payload);
    setRunning(true);
    setExecution(null);
    setErrorMessage(null);

    try {
      const response = await axios.post<SentimentExecutionResult>('/api/mcp/sentiment', {
        toolName: selectedTool,
        parameters: payload,
        bypassCache
      });
      setExecution(response.data);
    } catch (error: unknown) {
      const message = extractErrorMessage(error, 'Failed to execute sentiment tool');
      setExecution({ success: false, error: message });
    } finally {
      setRunning(false);
    }
  };

  const renderFieldDescription = (key: string) => {
    const description = toolMeta?.inputSchema?.properties?.[key]?.description;
    if (!description) return null;
    return <p className="text-xs text-gray-500 mt-1">{description}</p>;
  };

  const renderInputs = () => {
    switch (selectedTool) {
      case 'get_twitter_player_sentiment':
      case 'get_reddit_player_sentiment':
      case 'get_combined_player_sentiment':
      case 'analyze_player_narrative_trend':
      case 'detect_narrative_shift':
      case 'compare_players_sentiment':
        break;
      default:
        return (
          <div className="text-sm text-red-600">
            Unknown tool selected. Please refresh tool definitions.
          </div>
        );
    }

    return (
      <div className="space-y-5">
        {/* Common player_name */}
        {(selectedTool !== 'compare_players_sentiment') && (
          <div>
            <label className="block text-sm font-semibold mb-1">Player / Subject</label>
            <input
              type="text"
              value={formValues.player_name ?? ''}
              onChange={(event) => handleInputChange('player_name', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. LeBron James"
            />
            {renderFieldDescription('player_name')}
          </div>
        )}

        {/* Twitter limit + timeframe */}
        {(selectedTool === 'get_twitter_player_sentiment' || selectedTool === 'get_combined_player_sentiment' || selectedTool === 'compare_players_sentiment') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold mb-1">Timeframe</label>
              <select
                value={formValues.timeframe ?? ''}
                onChange={(event) => handleInputChange('timeframe', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Default</option>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {renderFieldDescription('timeframe')}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Sample Limit</label>
              <input
                type="number"
                min={1}
                value={formValues.limit ?? ''}
                onChange={(event) => handleInputChange('limit', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="200"
              />
              {renderFieldDescription('limit')}
            </div>
          </div>
        )}

        {/* Reddit subreddits */}
        {selectedTool === 'get_reddit_player_sentiment' && (
          <div>
            <label className="block text-sm font-semibold mb-1">Subreddits (comma separated)</label>
            <input
              type="text"
              value={formValues.subreddits ?? ''}
              onChange={(event) => handleInputChange('subreddits', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="nba, nba_discussion"
            />
            {renderFieldDescription('subreddits')}
          </div>
        )}

        {/* Combined sources */}
        {selectedTool === 'get_combined_player_sentiment' && (
          <div>
            <span className="block text-sm font-semibold mb-2">Sources</span>
            <div className="flex flex-wrap gap-4">
              {['twitter', 'reddit', 'narrative'].map((source) => (
                <label key={source} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues.sources?.[source])}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        sources: {
                          ...(prev.sources ?? {}),
                          [source]: event.target.checked
                        }
                      }))
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="capitalize">{source}</span>
                </label>
              ))}
            </div>
            {renderFieldDescription('sources')}
          </div>
        )}

        {/* Narrative compare periods */}
        {selectedTool === 'analyze_player_narrative_trend' && (
          <div>
            <label className="block text-sm font-semibold mb-1">Compare Periods</label>
            <input
              type="text"
              value={formValues.compare_periods ?? ''}
              onChange={(event) => handleInputChange('compare_periods', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30d,7d,24h"
            />
            {renderFieldDescription('compare_periods')}
          </div>
        )}

        {/* Narrative shift sensitivity */}
        {selectedTool === 'detect_narrative_shift' && (
          <div>
            <label className="block text-sm font-semibold mb-1">Sensitivity</label>
            <select
              value={formValues.sensitivity ?? 'medium'}
              onChange={(event) => handleInputChange('sensitivity', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SENSITIVITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {renderFieldDescription('sensitivity')}
          </div>
        )}

        {/* Compare players */}
        {selectedTool === 'compare_players_sentiment' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Player 1</label>
              <input
                type="text"
                value={formValues.player1_name ?? ''}
                onChange={(event) => handleInputChange('player1_name', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="LeBron James"
              />
              {renderFieldDescription('player1_name')}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Player 2</label>
              <input
                type="text"
                value={formValues.player2_name ?? ''}
                onChange={(event) => handleInputChange('player2_name', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Stephen Curry"
              />
              {renderFieldDescription('player2_name')}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Timeframe</label>
              <select
                value={formValues.timeframe ?? ''}
                onChange={(event) => handleInputChange('timeframe', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Default</option>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {renderFieldDescription('timeframe')}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStatusCard = () => (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Sentiment MCP Connectivity</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ensure the sentiment worker is reachable and credentials (Twitter/X & Reddit) are configured.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loadingStatus}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingStatus ? 'Refreshing...' : 'Refresh status'}
        </button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${status?.connected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm font-semibold">
              {status?.connected ? 'Connected to Sentiment MCP' : 'Sentiment MCP disconnected'}
            </span>
          </div>
          {status?.error && (
            <p className="mt-2 text-xs text-red-600">{status.error}</p>
          )}
          <div className="mt-4 text-xs text-gray-600">
            <div>Feature flag: {process.env.NEXT_PUBLIC_USE_SENTIMENT_SERVER === 'true' ? 'enabled' : 'check env'}</div>
            {status?.cache && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] uppercase text-gray-400">Cache size</div>
                  <div className="font-semibold">{status.cache.size}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-gray-400">Hit rate</div>
                  <div className="font-semibold">{status.cache.hitRate}%</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Available tools</h3>
          <div className="space-y-2 text-xs text-gray-700 max-h-48 overflow-auto">
            {status?.tools?.length ? (
              status.tools.map((tool) => (
                <div key={tool.name} className="rounded border border-gray-100 bg-gray-50 p-2">
                  <div className="font-mono text-blue-600">{tool.name}</div>
                  {tool.description && <div className="mt-1 text-gray-600">{tool.description}</div>}
                </div>
              ))
            ) : (
              <div>No tools reported. Ensure the sentiment worker has started and exported definitions.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const exampleSubjects = ['LeBron James', 'Stephen Curry', 'Victor Wembanyama', 'Boston Celtics', 'Dallas Mavericks'];

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16">
      <div className="space-y-10">
        {renderStatusCard()}

        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/60 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Run Sentiment Tool</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select a sentiment tool, tweak parameters, and execute against the MCP worker. Toggle cache bypass to force live pulls.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={bypassCache}
                onChange={(event) => setBypassCache(event.target.checked)}
                className="rounded border-gray-300"
              />
              Bypass cache
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">Tool</label>
              <select
                value={selectedTool}
                onChange={handleToolChange}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(status?.tools ?? []).map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-600">
              <span className="mb-1 block font-semibold">Description</span>
              <span>{toolMeta?.description ?? '—'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {exampleSubjects.map((subject) => (
              <button
                key={subject}
                onClick={() => handleInputChange('player_name', subject)}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                {subject}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-6">
            {renderInputs()}
          </div>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            onClick={runTool}
            disabled={running || !selectedTool}
            className="inline-flex w-full items-center justify-center rounded-md bg-green-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
          >
            {running ? 'Running...' : 'Execute tool'}
          </button>

          {execution && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                    execution.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {execution.success ? 'Execution succeeded' : 'Execution failed'}
                </span>
                {typeof execution.cached === 'boolean' && (
                  <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                    {execution.cached ? 'Served from cache' : 'Fresh fetch'}
                  </span>
                )}
                {execution.executionTime !== undefined && (
                  <span className="text-gray-600">{execution.executionTime} ms</span>
                )}
              </div>

              {!execution.success && execution.error && (
                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {execution.error}
                </p>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <JsonCard
                  title="Request payload"
                  data={lastPayload}
                  emptyLabel="No parameters supplied."
                />
                <JsonCard
                  title="Response body"
                  data={responsePreview}
                  emptyLabel={execution.success ? 'Execution returned no body.' : 'No response received.'}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type JsonCardProps = {
  title: string;
  data: unknown;
  emptyLabel?: string;
};

function JsonCard({ title, data, emptyLabel = 'No data available.' }: JsonCardProps) {
  const { formatted, error } = formatJsonForDisplay(data);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!formatted) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(formatted);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch (copyError) {
        console.error('Failed to copy JSON', copyError);
      }
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {formatted && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {formatted ? (
          <div className="max-h-[360px] overflow-auto">
            <pre className="m-0 max-h-[360px] overflow-auto bg-[#1e1e1e] px-4 py-3 text-xs leading-relaxed text-[#d4d4d4]">
              <code className="language-json">{formatted}</code>
            </pre>
          </div>
        ) : (
          <p className="px-4 py-6 text-xs text-slate-400">{emptyLabel}</p>
        )}
      </div>
      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

type FormatJsonResult = {
  formatted: string | null;
  error?: string | null;
};

function formatJsonForDisplay(value: unknown): FormatJsonResult {
  if (value === undefined || value === null) {
    return { formatted: null };
  }

  if (typeof value === 'string') {
    return formatJsonString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return { formatted: JSON.stringify(value, null, 2) };
  }

  if (typeof value === 'bigint') {
    return { formatted: value.toString() };
  }

  try {
    return { formatted: JSON.stringify(value, jsonReplacer, 2) };
  } catch (error) {
    return {
      formatted: JSON.stringify(String(value), null, 2),
      error: `Unable to format JSON payload: ${String(error)}`
    };
  }
}

function formatJsonString(input: string): FormatJsonResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { formatted: null };
  }

  const attempts = [trimmed];
  const relaxed = relaxEscapedJson(trimmed);
  if (relaxed !== trimmed) {
    attempts.push(relaxed);
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      return { formatted: JSON.stringify(parsed, jsonReplacer, 2) };
    } catch (parseError) {
      // continue trying other strategies
    }
  }

  return {
    formatted: trimmed,
    error: 'Displayed raw string. Unable to parse as JSON—verify escaping and structure.'
  };
}

function relaxEscapedJson(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\f/g, '\f')
    .replace(/\\b/g, '\b')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '\\');
}

function jsonReplacer(_key: string, val: unknown) {
  if (val instanceof Date) {
    return val.toISOString();
  }

  if (typeof val === 'bigint') {
    return val.toString();
  }

  if (val instanceof Map) {
    return Object.fromEntries(val);
  }

  if (val instanceof Set) {
    return Array.from(val);
  }

  return val;
}
