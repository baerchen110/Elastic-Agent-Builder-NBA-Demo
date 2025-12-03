/**
 * MCP Health Check API Route
 * Returns status of MCP servers and cache statistics
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { extractErrorMessage } from '@/lib/api';
import type { AggregatorServerSnapshot, AggregatorStatusSnapshot, HealthResponse, ToolSummary } from '@/lib/types';

interface MCPAggregatorModule {
  getStatus(): AggregatorStatusSnapshot;
  initialize(): Promise<void>;
}

function summariseTools(tools: ToolSummary[]): ToolSummary[] {
  return tools.map(({ name, description }) => ({ name, description }));
}

function buildServerSnapshot(server?: AggregatorServerSnapshot): AggregatorServerSnapshot {
  if (!server) {
    return {
      connected: false,
      tools: [],
      toolCount: 0
    };
  }

  return {
    connected: server.connected,
    tools: summariseTools(server.tools ?? []),
    toolCount: server.toolCount ?? (server.tools?.length ?? 0)
  };
}

async function handleHealthCheck(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Import aggregator dynamically from built dist directory
    const aggregatorPath = '../../../../backend/mcp-aggregator/dist/index.js';
    const { getAggregator } = (await import(aggregatorPath)) as { getAggregator: () => MCPAggregatorModule };

    const aggregator = getAggregator();

    // Get status
    const status = aggregator.getStatus();

    // Build servers object dynamically based on which servers are present
    const servers: HealthResponse['servers'] = {
      elastic: buildServerSnapshot(status.servers.elastic)
    };

    // Add NBA or BallDontLie server (whichever is active)
    if (status.servers.nba) {
      servers.nba = buildServerSnapshot(status.servers.nba);
    } else if (status.servers.balldontlie) {
      servers.balldontlie = buildServerSnapshot(status.servers.balldontlie);
    }

    if (status.servers.sentiment) {
      servers.sentiment = buildServerSnapshot(status.servers.sentiment);
    }

    const health: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      servers,
      cache: status.cacheStats,
      uptime: Math.floor(status.uptime / 1000)
    };

    // Overall health status - consider all available servers (elastic + optional others)
    const serverSnapshots = (Object.values(servers).filter(Boolean) as AggregatorServerSnapshot[]);
    const totalServers = serverSnapshots.length;
    const connectedServers = serverSnapshots.filter(snapshot => snapshot.connected).length;

    if (totalServers > 0 && connectedServers === totalServers) {
      health.status = 'healthy';
    } else if (connectedServers > 0) {
      health.status = 'degraded';
    } else {
      health.status = 'unhealthy';
    }

    return res.status(200).json(health);
  } catch (error: unknown) {
    const message = extractErrorMessage(error, 'Internal server error');
    console.error('[API] Health check error:', message);
    return res.status(500).json({
      status: 'error',
      error: message,
      timestamp: new Date().toISOString()
    });
  }
}

export default handleHealthCheck;
