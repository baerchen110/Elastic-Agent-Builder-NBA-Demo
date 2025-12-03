/**
 * HTTP Server for MCP Aggregator
 * Exposes aggregator functionality via REST API for Docker containerization
 */

import express from 'express';
import cors from 'cors';
import { getAggregator } from './index.js';
import { summarizeResults, summarizeResultsStream } from './summarizer.js';

const app = express();
const PORT = parseInt(process.env.MCP_AGGREGATOR_PORT || '3003', 10);
const HOST = process.env.MCP_AGGREGATOR_HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const aggregator = getAggregator();
    const status = aggregator.getStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      servers: Object.entries(status.servers).reduce((acc, [name, server]) => {
        acc[name] = {
          connected: server.connected,
          toolCount: server.tools.length
        };
        return acc;
      }, {} as Record<string, { connected: boolean; toolCount: number }>),
      cache: {
        size: status.cacheStats.size,
        hits: status.cacheStats.hits,
        misses: status.cacheStats.misses,
        hitRate: status.cacheStats.hitRate
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Query endpoint
app.post('/api/query', async (req, res) => {
  try {
    const { query, filters, summarize = false } = req.body;

    console.log('[HTTP Server] /api/query called with:', {
      query: query?.substring(0, 50),
      hasSummarize: 'summarize' in req.body,
      summarizeValue: summarize,
      summarizeType: typeof summarize
    });

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a string'
      });
    }

    const aggregator = getAggregator();

    // Initialize if not already initialized
    const status = aggregator.getStatus();
    const hasConnectedServers = Object.values(status.servers).some(s => s.connected);

    if (!hasConnectedServers) {
      await aggregator.initialize();
    }

    // Execute query
    const result = await aggregator.executeQuery({ query, filters });

    // If summarize is requested, use LLM to convert results to natural language
    let summary: string | undefined;
    if (summarize) {
      console.log('[HTTP Server] Generating LLM summary for query:', query.substring(0, 50) + '...');
      summary = await summarizeResults(query, result);
    }

    res.json({
      success: true,
      data: {
        results: result.results,
        summary,
        toolsUsed: result.toolsUsed,
        metadata: {
          intent: result.intent,
          cached: result.cached,
          executionTime: result.executionTime
        }
      }
    });
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Query streaming endpoint (SSE)
app.post('/api/query/stream', async (req, res) => {
  try {
    const { query, filters } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a string'
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const aggregator = getAggregator();

    // Initialize if not already initialized
    const status = aggregator.getStatus();
    const hasConnectedServers = Object.values(status.servers).some(s => s.connected);

    if (!hasConnectedServers) {
      await aggregator.initialize();
    }

    console.log('[HTTP Server] Streaming query:', query.substring(0, 50) + '...');

    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status', content: 'Executing query...' })}\n\n`);

    // Execute query
    const result = await aggregator.executeQuery({ query, filters });

    // Send metadata
    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      toolsUsed: result.toolsUsed,
      intent: result.intent,
      cached: result.cached,
      executionTime: result.executionTime
    })}\n\n`);

    // Stream the summary
    console.log('[HTTP Server] Starting LLM summary stream...');

    await summarizeResultsStream(query, result, (chunk) => {
      if (res.writableEnded) return;

      res.write(`data: ${JSON.stringify({
        type: chunk.type,
        content: chunk.content,
        fullContent: chunk.fullContent
      })}\n\n`);
    });

    res.end();

  } catch (error) {
    console.error('Streaming query error:', error);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error occurred'
      })}\n\n`);
      res.end();
    }
  }
});

// Sentiment endpoints
app.get('/api/sentiment/tools', async (req, res) => {
  try {
    const aggregator = getAggregator();
    const tools = await aggregator.listSentimentTools();

    res.json({
      success: true,
      data: {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        })),
        totalTools: tools.length
      }
    });
  } catch (error) {
    console.error('Error listing sentiment tools:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/sentiment/execute', async (req, res) => {
  try {
    const { toolName, parameters, bypassCache } = req.body;

    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'toolName parameter is required and must be a string'
      });
    }

    const aggregator = getAggregator();
    const result = await aggregator.executeSentimentTool(toolName, parameters || {}, {
      bypassCache
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing sentiment tool:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available tools
app.get('/api/tools', async (req, res) => {
  try {
    const aggregator = getAggregator();
    const status = aggregator.getStatus();

    const tools = Object.entries(status.servers).reduce((acc, [serverId, server]) => {
      if (server.connected && server.tools) {
        acc[serverId] = server.tools.map(tool => ({
          name: tool.name,
          description: tool.description
        }));
      }
      return acc;
    }, {} as Record<string, Array<{ name: string; description: string }>>);

    // Calculate total tools
    const totalTools = Object.values(status.servers)
      .filter(s => s.connected)
      .reduce((sum, s) => sum + s.tools.length, 0);

    res.json({
      success: true,
      data: {
        tools,
        totalTools
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
async function start() {
  try {
    // Initialize aggregator
    console.log('🚀 Initializing MCP Aggregator...');
    const aggregator = getAggregator();
    await aggregator.initialize();

    const status = aggregator.getStatus();
    console.log('✅ MCP Aggregator initialized');
    console.log('📊 Connected servers:', Object.entries(status.servers)
      .filter(([_, s]) => s.connected)
      .map(([name, s]) => `${name} (${s.tools.length} tools)`)
      .join(', '));

    // Start HTTP server
    app.listen(PORT, HOST, () => {
      console.log('════════════════════════════════════════');
      console.log('🌐 MCP Aggregator HTTP Server');
      console.log('════════════════════════════════════════');
      console.log(`✅ Server running on http://${HOST}:${PORT}`);
      console.log(`✅ Health check: http://${HOST}:${PORT}/health`);
      console.log(`✅ Query API: http://${HOST}:${PORT}/api/query`);
      console.log(`✅ Streaming API: http://${HOST}:${PORT}/api/query/stream`);
      console.log(`✅ Tools API: http://${HOST}:${PORT}/api/tools`);
      console.log('════════════════════════════════════════');
    });
  } catch (error) {
    console.error('❌ Failed to start MCP Aggregator HTTP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the server
start().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
