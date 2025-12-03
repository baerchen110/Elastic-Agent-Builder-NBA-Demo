'use client';

/**
 * MCP Query Test Component
 * Interactive UI for testing MCP Aggregator
 */

import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { extractErrorMessage } from '@/lib/api';
import type { HealthResponse, QueryExecutionResponse, ToolSummary } from '@/lib/types';

const exampleQueries = [
  'How did LeBron James perform this season?',
  'What are the live games today?',
  'Analyze Stephen Curry shooting statistics',
  'Compare Luka Doncic and Giannis performance',
  'Show me player trends over the last 5 games'
];

export default function MCPQueryTest() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryExecutionResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  const executeQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    setShowRawData(false);

    try {
      const response = await axios.post<QueryExecutionResponse>('/api/mcp/query', { query });
      setResult(response.data);
    } catch (error: unknown) {
      const message = extractErrorMessage(error, 'Failed to execute query');
      setResult({
        success: false,
        error: message
      });
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async () => {
    try {
      const response = await axios.get<HealthResponse>('/api/mcp/health');
      setHealth(response.data);
    } catch (error: unknown) {
      console.error('Health check failed:', extractErrorMessage(error));
    }
  };

  const loadExample = (exampleQuery: string) => {
    setQuery(exampleQuery);
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-2">MCP Aggregator Test</h1>
        <p className="text-gray-600 mb-6">
          Test the MCP Aggregator that combines Elastic Agent Builder, NBA data sources, and the Sentiment MCP Server.
        </p>

        {/* Health Status */}
        <div className="mb-6">
          <button
            onClick={checkHealth}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Check Health
          </button>

          {health && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health.status === 'healthy'
                      ? 'bg-green-500'
                      : health.status === 'degraded'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="font-semibold capitalize">{health.status}</span>
              </div>

              <div className="space-y-4">
                {/* Elastic Agent Builder */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <span>Elastic Agent Builder</span>
                    <span className="text-xs text-gray-500">
                      {health.servers.elastic.connected ? '✅ Connected' : '❌ Disconnected'}
                    </span>
                  </div>
                  {(() => {
                    const elasticTools = health.servers.elastic.tools ?? [];
                    const elasticToolCount = health.servers.elastic.toolCount ?? elasticTools.length;

                    if (!health.servers.elastic.connected || elasticTools.length === 0) {
                      return <div className="text-xs text-gray-500">No tools available</div>;
                    }

                    return (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 mb-2">
                        {elasticToolCount} {elasticToolCount === 1 ? 'tool' : 'tools'} available:
                      </div>
                      {elasticTools.map((tool: ToolSummary) => (
                        <div key={tool.name} className="bg-white border border-gray-100 rounded p-2 text-xs">
                          <div className="font-mono font-semibold text-blue-600">{tool.name}</div>
                          <div className="text-gray-600 mt-1">{typeof tool.description === 'string' ? tool.description : 'No description'}</div>
                        </div>
                      ))}
                    </div>
                    );
                  })()}
                </div>

                {/* NBA MCP Server (dynamic: either nba or balldontlie) */}
                {(health.servers.nba || health.servers.balldontlie) && (
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      <span>{health.servers.nba ? 'NBA MCP Server' : 'BallDontLie API'}</span>
                      <span className="text-xs text-gray-500">
                        {(health.servers.nba?.connected || health.servers.balldontlie?.connected) ? '✅ Connected' : '❌ Disconnected'}
                      </span>
                    </div>
                    {(() => {
                      const nbaServer = health.servers.nba || health.servers.balldontlie;
                      const nbaTools = nbaServer?.tools ?? [];

                      if (!nbaServer || !nbaServer.connected || nbaTools.length === 0) {
                        return <div className="text-xs text-gray-500">No tools available</div>;
                      }

                      const toolCount = nbaServer.toolCount ?? nbaTools.length;

                      return (
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600 mb-2">
                            {toolCount} {toolCount === 1 ? 'tool' : 'tools'} available:
                          </div>
                          {nbaTools.map((tool: ToolSummary) => (
                            <div key={tool.name} className="bg-white border border-gray-100 rounded p-2 text-xs">
                              <div className="font-mono font-semibold text-green-600">{tool.name}</div>
                              <div className="text-gray-600 mt-1">{typeof tool.description === 'string' ? tool.description : 'No description'}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Sentiment MCP Server */}
                {health.servers.sentiment && (
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      <span>Sentiment MCP Server</span>
                      <span className="text-xs text-gray-500">
                        {health.servers.sentiment.connected ? '✅ Connected' : '❌ Disconnected'}
                      </span>
                    </div>
                    {health.servers.sentiment.connected && (health.servers.sentiment.tools?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600 mb-2">
                          {(health.servers.sentiment.toolCount ?? health.servers.sentiment.tools?.length ?? 0)}{' '}
                          {(health.servers.sentiment.toolCount ?? health.servers.sentiment.tools?.length ?? 0) === 1 ? 'tool' : 'tools'} available:
                        </div>
                        {(health.servers.sentiment.tools ?? []).map((tool: ToolSummary) => (
                          <div key={tool.name} className="bg-white border border-gray-100 rounded p-2 text-xs">
                            <div className="font-mono font-semibold text-purple-600">{tool.name}</div>
                            <div className="text-gray-600 mt-1">
                              {typeof tool.description === 'string' ? tool.description : 'No description'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        {health.servers.sentiment.connected
                          ? 'No sentiment tools reported yet.'
                          : 'Sentiment server unavailable. Check credentials or feature flags.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="font-semibold mb-1">Cache Statistics</div>
                <div className="text-sm text-gray-600">
                  <span className="mr-4">Size: {health.cache.size}</span>
                  <span className="mr-4">Hits: {health.cache.hits}</span>
                  <span className="mr-4">Misses: {health.cache.misses}</span>
                  <span>Hit Rate: {health.cache.hitRate}%</span>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                Uptime: {Math.floor(health.uptime / 60)}m {health.uptime % 60}s
              </div>
            </div>
          )}
        </div>

        {/* Example Queries */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Example Queries:</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {exampleQueries.map((example, idx) => (
              <button
                key={idx}
                onClick={() => loadExample(example)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
            <div className="font-semibold text-green-900 mb-1">🧠 Intelligent Query Routing</div>
            <div className="text-green-800 space-y-2">
              <div>
                  <strong>Elasticsearch (Primary):</strong> Used for natural language queries, analytics, and historical data.
                Leverages semantic search for better understanding.
              </div>
              <div>
                  <strong>NBA MCP Server (Real-time only):</strong> Used when you explicitly ask for &quot;live&quot;, &quot;today&quot;, &quot;current&quot; data.
                Provides 14+ comprehensive NBA tools including live scoreboard, player info, game logs, and team data.
              </div>
              <div>
                <strong>Sentiment MCP Server:</strong> Captures Twitter/X, Reddit, and narrative signals for momentum or buzz monitoring.
              </div>
              <div className="text-xs mt-2 bg-green-100 p-2 rounded">
                <strong>Examples:</strong>
                <ul className="list-disc ml-4 mt-1">
                    <li>&quot;LeBron James stats&quot; → Elasticsearch (semantic search)</li>
                    <li>&quot;What games are live today?&quot; → NBA MCP Server (real-time)</li>
                    <li>&quot;Analyze shooting trends&quot; → Elasticsearch (analytics)</li>
                    <li>&quot;Get player career stats&quot; → NBA MCP Server (structured data)</li>
                    <li>&quot;How is the fan sentiment around LeBron right now?&quot; → Sentiment MCP Server (social signals)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Query Input */}
        <div className="mb-4">
          <label className="block font-semibold mb-2">Query:</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeQuery()}
            placeholder="Enter your query..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={executeQuery}
          disabled={loading || !query.trim()}
          className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
        >
          {loading ? 'Executing...' : 'Execute Query'}
        </button>

        {/* Results */}
        {result && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Result:</h3>
            <div
              className={`p-4 rounded-lg ${
                result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              {result.success && result.data ? (
                <div>
                  {/* Metadata */}
                  <div className="mb-4 pb-3 border-b border-green-200 space-y-1">
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="font-semibold">Intent:</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {result.data.intent}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">Tools Used:</span>{' '}
                      {result.data.toolsUsed.map((tool, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-mono mr-1 mt-1"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>
                        <span className="font-semibold">Cached:</span>{' '}
                        {result.data.cached ? (
                          <span className="text-green-600">✓ Yes</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </span>
                      <span>
                        <span className="font-semibold">Time:</span> {result.data.executionTime}ms
                      </span>
                    </div>
                  </div>

                  {/* LLM Summary */}
                  {result.data.summary && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-semibold">📊 Summary</span>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 rounded text-xs font-medium">
                          AI-Generated
                        </span>
                      </div>
                      <div className="prose prose-sm max-w-none bg-white p-4 rounded-lg border border-green-200">
                        <ReactMarkdown>{result.data.summary}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Summary Error */}
                  {result.data.summaryError && !result.data.summary && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-sm text-yellow-800">
                        <strong>⚠️ Summary Generation Failed:</strong> {result.data.summaryError}
                      </div>
                      <div className="text-xs text-yellow-700 mt-1">Displaying raw data below.</div>
                    </div>
                  )}

                  {/* Raw Data Toggle */}
                  <div className="mt-4">
                    <button
                      onClick={() => setShowRawData(!showRawData)}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
                    >
                      <span>{showRawData ? '▼' : '▶'}</span>
                      <span>{showRawData ? 'Hide' : 'Show'} Raw Data</span>
                    </button>

                    {showRawData && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <pre className="bg-white p-3 rounded border border-green-200 overflow-auto text-xs max-h-96">
                          {JSON.stringify(result.data.results, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-red-700">
                  <strong>Error:</strong> {result.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
