/**
 * MCP Query API Route
 * Handles queries to the MCP Aggregator with optional LLM summarization
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { extractErrorMessage } from '@/lib/api';
import type { AggregatorStatusSnapshot, QueryExecutionData } from '@/lib/types';
import { summarizeResults, shouldSummarize } from '@/lib/llm-summarizer';

interface MCPAggregatorModule {
  getStatus(): AggregatorStatusSnapshot;
  initialize(): Promise<void>;
  executeQuery(request: { query: string; filters?: Record<string, unknown> }): Promise<QueryExecutionData>;
}

// Dynamic import to avoid module resolution issues
async function handleQuery(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, filters, summarize = true } = req.body as {
      query?: string;
      filters?: Record<string, unknown>;
      summarize?: boolean;
    };

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Import aggregator dynamically from built dist directory
    const aggregatorPath = '../../../../backend/mcp-aggregator/dist/index.js';
    const { getAggregator } = (await import(aggregatorPath)) as { getAggregator: () => MCPAggregatorModule };

    const aggregator = getAggregator();

    // Initialize if not already initialized
    const status = aggregator.getStatus();
    const nbaConnected = status.servers.nba?.connected || status.servers.balldontlie?.connected || false;
    const elasticConnected = status.servers.elastic?.connected ?? false;

    if (!elasticConnected && !nbaConnected) {
      await aggregator.initialize();
    }

    // Execute the query
    const result = await aggregator.executeQuery({ query, filters });

    // Generate LLM summary if requested and appropriate
    if (summarize && shouldSummarize(result.results)) {
      console.log('[API] Generating LLM summary for query:', query);

      const summaryResult = await summarizeResults({
        query,
        intent: result.intent,
        toolsUsed: result.toolsUsed,
        results: result.results,
        executionTime: result.executionTime,
        cached: result.cached
      });

      if (summaryResult.error) {
        console.warn('[API] Summary generation failed:', summaryResult.error);
        result.summaryError = summaryResult.error;
      } else {
        result.summary = summaryResult.summary;
      }
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    const message = extractErrorMessage(error, 'Internal server error');
    console.error('[API] Query error:', message);
    return res.status(500).json({
      success: false,
      error: message
    });
  }
}

export default handleQuery;
