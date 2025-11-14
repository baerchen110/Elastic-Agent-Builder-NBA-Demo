/**
 * MCP Tools Inspection API Route
 * Returns detailed information about all available tools
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { extractErrorMessage } from '@/lib/api';
import type { AggregatorServerSnapshot, AggregatorStatusSnapshot } from '@/lib/types';

interface MCPAggregatorModule {
  getStatus(): AggregatorStatusSnapshot;
  initialize(): Promise<void>;
}

interface ServerToolsResponse extends AggregatorServerSnapshot {
  tools: NonNullable<AggregatorServerSnapshot['tools']>;
}

function buildServerResponse(server?: AggregatorServerSnapshot): ServerToolsResponse {
  const tools = server?.tools ?? [];
  return {
    connected: server?.connected ?? false,
    tools,
    toolCount: server?.toolCount ?? tools.length
  };
}

async function handleToolsInspection(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    // Get detailed status with full tool schemas
    const fullStatus = aggregator.getStatus();

    // Build servers response dynamically
    const servers: Record<string, ServerToolsResponse> = {
      elastic: buildServerResponse(fullStatus.servers.elastic)
    };

    // Add NBA or BallDontLie server (whichever is active)
    if (fullStatus.servers.nba) {
      servers.nba = buildServerResponse(fullStatus.servers.nba);
    } else if (fullStatus.servers.balldontlie) {
      servers.balldontlie = buildServerResponse(fullStatus.servers.balldontlie);
    }

    if (fullStatus.servers.sentiment) {
      servers.sentiment = buildServerResponse(fullStatus.servers.sentiment);
    }

    return res.status(200).json({
      success: true,
      servers
    });
  } catch (error: unknown) {
    const message = extractErrorMessage(error, 'Internal server error');
    console.error('[API] Tools inspection error:', message);
    return res.status(500).json({
      success: false,
      error: message
    });
  }
}

export default handleToolsInspection;
