/**
 * Node.js WebSocket Server with Streaming Support - FIXED
 * No external EventSource dependency - uses native fetch streaming
 *
 * Features:
 * - WebSocket gateway for React frontend
 * - Native Node.js streaming (no external deps for SSE)
 * - Real-time progress updates
 *
 * NO NEED TO INSTALL: npm install eventsource
 * Just works with Node.js built-in modules!
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

const PYTHON_BACKEND = process.env.PYTHON_BACKEND || 'http://localhost:3002';
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

console.log('⚙️  Configuration:');
console.log(`   Node.js Server: http://${HOST}:${PORT}`);
console.log(`   Python Backend: ${PYTHON_BACKEND}`);

const clientConnections = new Map();

// ===== REST ENDPOINTS =====

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🏀 NBA Multi-Agent Backend Running',
    version: '2.1.0',
    features: ['streaming', 'websocket', 'multi-agent'],
    backend: 'FastAPI (Python)',
    python_backend: PYTHON_BACKEND
  });
});

app.get('/api/agents', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_BACKEND}/api/agents`, {
      timeout: parseInt(process.env.AGENTS_API_TIMEOUT_MS || '5000', 10)
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

      // ===== HANDLE STREAMING QUERY =====
      if (message.type === 'query_stream') {
        const { query, chunk_size = 1, delay_ms = 50 } = message;

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
          content: '⏳ Starting stream...',
          timestamp: new Date().toISOString()
        }));

        try {
          console.log(`🚀 Starting stream from Python backend: ${query.substring(0, 50)}...`);

          // Stream from FastAPI backend using native fetch
          const streamUrl = `${PYTHON_BACKEND}/api/query/stream`;

          const response = await fetch(streamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
              query,
              chunk_size,
              delay_ms
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Read streaming response using native ReadableStream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('✅ Stream complete');
              break;
            }

            // Decode chunk
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1]; // Keep incomplete line

            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];

              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));

                  console.log(`📤 Stream chunk: type=${data.type}, progress=${data.progress}%`);

                  // Forward to WebSocket client
                  ws.send(JSON.stringify({
                    type: data.type,
                    content: data.content,
                    fullContent: data.full_content,
                    progress: data.progress,
                    wordsSent: data.words_sent,
                    totalWords: data.total_words,
                    success: data.success,
                    timestamp: data.timestamp
                  }));

                } catch (e) {
                  console.error('Error parsing SSE data:', e.message);
                }
              }
            }
          }

        } catch (error) {
          console.error(`❌ Error streaming from Python backend:`, error.message);

          let errorMessage = error.message;

          if (error.message.includes('ECONNREFUSED')) {
            errorMessage = 'Cannot connect to Python backend. Make sure it\'s running on port 3002';
          }

          ws.send(JSON.stringify({
            type: 'error',
            content: `⚠️ ${errorMessage}`,
            success: false,
            timestamp: new Date().toISOString()
          }));
        }
      }

      // ===== HANDLE STANDARD QUERY (Non-streaming) =====
      else if (message.type === 'query') {
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
          content: '⏳ Analyzing your question...',
          timestamp: new Date().toISOString()
        }));

        try {
          console.log(`🚀 Calling Python backend for query: ${query.substring(0, 50)}...`);

          const response = await axios.post(
            `${PYTHON_BACKEND}/api/query`,
            { query },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: parseInt(process.env.QUERY_API_TIMEOUT_MS || '120000', 10)
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

          let errorMessage = error.message;

          if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Cannot connect to Python backend. Make sure api_server.py is running on port 3002';
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

    // Configurable delay between words for streaming effect
    const streamingDelay = parseInt(process.env.WORD_STREAMING_DELAY_MS || '20', 10);
    await new Promise(resolve => setTimeout(resolve, streamingDelay));
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
  console.log('🏀 NBA Multi-Agent WebSocket Server v2.1');
  console.log('═'.repeat(60));
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`✅ WebSocket endpoint: ws://${HOST}:${PORT}`);
  console.log(`✅ Health check: http://${HOST}:${PORT}/health`);
  console.log('');
  console.log('Features:');
  console.log('  ✓ WebSocket gateway');
  console.log('  ✓ Server-Sent Events (SSE) streaming');
  console.log('  ✓ Word-by-word response streaming');
  console.log('  ✓ Real-time progress updates');
  console.log('  ✓ Native Node.js (no external deps!)');
  console.log('');
  console.log('Connected to Python FastAPI Backend:');
  console.log(`   REST API: ${PYTHON_BACKEND}`);
  console.log('');
  console.log('Frontend connects to: ws://localhost:3001');
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

export { app, wss, streamResponse };
