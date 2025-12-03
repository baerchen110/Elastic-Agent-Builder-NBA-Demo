/**
 * Sentiment MCP Test API Route
 * Provides sentiment-specific tool listings and execution helpers for the frontend tester.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { NextApiRequest, NextApiResponse } from 'next';
import { extractErrorMessage, isRecord } from '@/lib/api';
import type {
  AggregatorStatusSnapshot,
  SentimentExecutionResult,
  SentimentStatusResponse,
  SentimentToolDefinition
} from '@/lib/types';

interface SentimentExecuteRequest {
  toolName?: string;
  parameters?: Record<string, unknown>;
  bypassCache?: boolean;
}

interface MCPAggregatorModule {
  getStatus(): AggregatorStatusSnapshot;
  initialize(): Promise<void>;
  listSentimentTools(): Promise<SentimentToolDefinition[]>;
  executeSentimentTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: { bypassCache?: boolean }
  ): Promise<SentimentExecutionResult>;
}

function discoverAggregatorModulePath(): string {
  const overrides = process.env.MCP_AGGREGATOR_DIST?.split(path.delimiter).filter(Boolean) ?? [];
  const searchRoots = [process.cwd(), path.resolve(process.cwd(), '..'), path.resolve(process.cwd(), '../..')];

  const candidates = [
    ...overrides,
    ...searchRoots.map(root => path.resolve(root, 'backend/mcp-aggregator/dist/index.js'))
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate MCP Aggregator build. Run "npm run build" inside backend/mcp-aggregator or set MCP_AGGREGATOR_DIST.');
}

async function resolveAggregator(): Promise<MCPAggregatorModule> {
  const aggregatorPath = discoverAggregatorModulePath();
  const moduleUrl = pathToFileURL(aggregatorPath).href;
  const dynamicImport = new Function('specifier', 'return import(specifier);') as <T>(specifier: string) => Promise<T>;
  const { getAggregator } = (await dynamicImport(moduleUrl)) as {
    getAggregator: () => MCPAggregatorModule;
  };
  return getAggregator();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sentimentEnabled = process.env.USE_SENTIMENT_MCP_SERVER === 'true';
    if (!sentimentEnabled) {
      return res.status(503).json({
        success: false,
        error: 'Sentiment MCP server disabled via feature flag. Set USE_SENTIMENT_MCP_SERVER=true to enable.'
      });
    }

    const aggregator = await resolveAggregator();

    if (req.method === 'GET') {
      const statusBefore = aggregator.getStatus();
      const sentimentBefore = statusBefore.servers.sentiment;
      if (!sentimentBefore?.connected) {
        try {
          await aggregator.initialize();
        } catch (error: unknown) {
          const message = extractErrorMessage(error, 'Failed to initialize sentiment MCP server');
          return res.status(500).json({
            success: false,
            error: `Failed to initialize sentiment MCP server: ${message}`
          });
        }
      }

      const statusAfter = aggregator.getStatus();
      const sentimentAfter = statusAfter.servers.sentiment;

      try {
        const tools = await aggregator.listSentimentTools();
        const payload: SentimentStatusResponse = {
          success: true,
          connected: sentimentAfter?.connected ?? false,
          tools,
          cache: statusAfter.cacheStats
        };
        return res.status(200).json(payload);
      } catch (error: unknown) {
        const message = extractErrorMessage(error, 'Unable to list sentiment tools');
        return res.status(500).json({
          success: false,
          connected: sentimentAfter?.connected ?? false,
          error: message
        });
      }
    }

    if (req.method === 'POST') {
      const body = req.body as unknown;
      if (!isRecord(body)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request payload'
        });
      }

      const { toolName, parameters = {}, bypassCache = false } = body as SentimentExecuteRequest;

      if (!toolName || typeof toolName !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'toolName is required'
        });
      }

      try {
        const execution = await aggregator.executeSentimentTool(toolName, parameters, {
          bypassCache: Boolean(bypassCache)
        });

        return res.status(200).json({
          success: execution.success,
          cached: execution.cached,
          executionTime: execution.executionTime,
          result: execution.result,
          error: execution.error ?? null
        });
      } catch (error: unknown) {
        const message = extractErrorMessage(error, 'Failed to execute sentiment tool');
        return res.status(500).json({
          success: false,
          error: message
        });
      }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: unknown) {
    const message = extractErrorMessage(error, 'Internal server error');
    console.error('[API] Sentiment route error:', message);
    return res.status(500).json({
      success: false,
      error: message
    });
  }
}
