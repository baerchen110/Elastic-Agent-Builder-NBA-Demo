/**
 * Node.js WebSocket Server - Bridge to FastAPI Backend
 *
 * This server acts as a WebSocket gateway for your React frontend.
 * Instead of calling Kibana directly, it forwards requests to the Python FastAPI backend.
 *
 * Architecture:
 *   Browser (WebSocket)
 *        ↓
 *   Node.js server.js (this file)
 *        ↓
 *   Python FastAPI Backend (api_server.py)
 *        ↓
 *   LangGraph Multi-Agent System
 *        ↓
 *   Elastic Agent Builder
 *
 * Usage:
 *   npm install
 *   node server.js
 *
 * The server listens on ws://localhost:3001
 * FastAPI backend should be running on http://localhost:3002
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(cors());
app.use(express.json());

// ===== CONFIGURATION =====

// Python FastAPI backend URL
const PYTHON_BACKEND = process.env.PYTHON_BACKEND || 'http://localhost:3002';
const PYTHON_WS_BACKEND = process.env.PYTHON_WS_BACKEND || 'ws://localhost:3002';

// Port for this Node.js server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

console.log('⚙️  Configuration:');
console.log(`   Node.js Server: http://${HOST}:${PORT}`);
console.log(`   Python Backend (REST): ${PYTHON_BACKEND}`);
console.log(`   Python Backend (WebSocket): ${PYTHON_WS_BACKEND}`);

// Track active WebSocket connections to Python backend
const clientConnections = new Map();

// ===== REST ENDPOINTS =====

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🏀 NBA Multi-Agent Backend Running',
    version: '1.0.0',
    backend: 'FastAPI (Python)',
    python_backend: PYTHON_BACKEND
  });
});

app.get('/api/agents', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_BACKEND}/api/agents`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    console.error('❌ Error fetching agents:', error.message);
    res.status(500).json({
      error: 'Failed to fetch agents',
      message: error.message
    });
  }
});

// ===== WEBSOCKET ENDPOINT =====

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  console.log(`✅ Client connected: ${clientId}`);

  // Store connection info
  const connectionInfo = {
    clientId,
    connectedAt: new Date(),
    messagesCount: 0
  };
  clientConnections.set(clientId, connectionInfo);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      connectionInfo.messagesCount++;

      console.log(`📨 Message from ${clientId}: ${message.type}`);

      // ===== HANDLE QUERY =====
      if (message.type === 'query') {
        const { query } = message;

        if (!query || !query.trim()) {
          ws.send(JSON.stringify({
            type: 'error',
            content: 'Please enter a query',
            success: false,
            timestamp: new Date().toISOString()
          }));
          return;
        }

        // Send loading indicator
        ws.send(JSON.stringify({
          type: 'status',
          content: '⏳ Analyzing your question with multi-agent system...',
          timestamp: new Date().toISOString()
        }));

        try {
          // Option 1: Use HTTP REST API (simpler)
          console.log(`🚀 Calling Python backend for query: ${query.substring(0, 50)}...`);

          const response = await axios.post(
            `${PYTHON_BACKEND}/api/query`,
            { query },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 120000 // 2 minute timeout for complex queries
            }
          );

          if (response.data.success) {
            const fullContent = response.data.result;
            const agentsUsed = response.data.agents_used || [];

            console.log(`✅ Got response from Python backend (${fullContent.length} chars)`);

            // Stream response word by word
            await streamResponse(ws, fullContent, agentsUsed);
          } else {
            const errorMsg = response.data.error || 'Unknown error';
            console.error(`❌ Python backend error: ${errorMsg}`);

            ws.send(JSON.stringify({
              type: 'error',
              content: `⚠️ Error: ${errorMsg}`,
              success: false,
              timestamp: new Date().toISOString()
            }));
          }

        } catch (error) {
          console.error(`❌ Error calling Python backend:`, error.message);

          // Provide helpful error messages
          let errorMessage = error.message;

          if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Cannot connect to Python backend. Make sure api_server.py is running on port 3002';
          } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Python backend not found. Check PYTHON_BACKEND configuration';
          } else if (error.response?.status === 404) {
            errorMessage = 'Python backend endpoint not found. Check if api_server.py is running correctly';
          }

          ws.send(JSON.stringify({
            type: 'error',
            content: `⚠️ ${errorMessage}`,
            success: false,
            timestamp: new Date().toISOString()
          }));
        }
      }

      // ===== HANDLE CLEAR =====
      else if (message.type === 'clear') {
        console.log(`🧹 Clearing conversation for ${clientId}`);

        ws.send(JSON.stringify({
          type: 'cleared',
          content: '✨ Chat history cleared',
          timestamp: new Date().toISOString()
        }));
      }

      // ===== UNKNOWN MESSAGE TYPE =====
      else {
        console.warn(`⚠️ Unknown message type: ${message.type}`);

        ws.send(JSON.stringify({
          type: 'error',
          content: `Unknown message type: ${message.type}`,
          success: false,
          timestamp: new Date().toISOString()
        }));
      }

    } catch (error) {
      console.error(`❌ Message parsing error for ${clientId}:`, error.message);

      ws.send(JSON.stringify({
        type: 'error',
        content: `Error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    const duration = new Date() - connectionInfo.connectedAt;
    console.log(
      `❌ Client disconnected: ${clientId} ` +
      `(Duration: ${Math.round(duration / 1000)}s, Messages: ${connectionInfo.messagesCount})`
    );
    clientConnections.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${clientId}:`, error.message);
  });
});

// ===== HELPER FUNCTIONS =====

/**
 * Stream response word by word to create typing effect
 */
async function streamResponse(ws, content, agentsUsed = []) {
  const words = content.split(' ');
  let streamedContent = '';

  console.log(`📤 Starting stream (${words.length} words)`);

  for (let i = 0; i < words.length; i++) {
    streamedContent += (i === 0 ? '' : ' ') + words[i];

    // Send chunk
    ws.send(JSON.stringify({
      type: 'chunk',
      content: words[i],
      fullContent: streamedContent,
      progress: Math.round((i / words.length) * 100),
      timestamp: new Date().toISOString()
    }));

    // 20ms delay between words for streaming effect
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  // Send completion message
  ws.send(JSON.stringify({
    type: 'complete',
    content,
    agents_used: agentsUsed,
    timestamp: new Date().toISOString(),
    success: true
  }));

  console.log('✅ Stream complete');
}

// ===== SERVER STARTUP =====

httpServer.listen(PORT, HOST, () => {
  console.log('');
  console.log('═'.repeat(60));
  console.log('🏀 NBA Multi-Agent WebSocket Server');
  console.log('═'.repeat(60));
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`✅ WebSocket endpoint: ws://${HOST}:${PORT}`);
  console.log(`✅ Health check: http://${HOST}:${PORT}/health`);
  console.log(`✅ Available agents: http://${HOST}:${PORT}/api/agents`);
  console.log('');
  console.log('Connected to Python FastAPI Backend:');
  console.log(`   REST API: ${PYTHON_BACKEND}`);
  console.log(`   WebSocket: ${PYTHON_WS_BACKEND}`);
  console.log('');
  console.log('💡 Frontend connects to: ws://localhost:3001');
  console.log('═'.repeat(60));
  console.log('');
});

// ===== GRACEFUL SHUTDOWN =====

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, wss, streamResponse };
