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

const KIBANA_URL = process.env.KIBANA_URL;
const API_KEY = process.env.ELASTICSEARCH_API_KEY;
const AGENT_ID = process.env.AGENT_ID || 'nba_commentary_assitante';

// Track active conversations
const conversations = new Map();

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  let conversationId = null;

  console.log(`✅ Client connected: ${clientId}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'query') {
        // Send loading indicator
        ws.send(JSON.stringify({
          type: 'status',
          content: '⏳ Analyzing your question...',
          timestamp: new Date().toISOString()
        }));

        const { query } = message;

        // Call Elastic Agent Builder
        const payload = {
          input: query,
          agent_id: AGENT_ID
        };

        if (conversationId) {
          payload.conversation_id = conversationId;
        }

        const response = await axios.post(
          `${KIBANA_URL}/api/agent_builder/converse`,
          payload,
          {
            headers: {
              'Authorization': `ApiKey ${API_KEY}`,
              'Content-Type': 'application/json',
              'kbn-xsrf': 'true'
            },
            timeout: 60000
          }
        );

        conversationId = response.data.conversation_id;
        const fullContent = response.data.response?.message || 'No response';
        const toolsUsed = response.data.response?.tools_invoked || [];

        console.log('📤 Starting stream for response...');

        // ===== STREAMING: Send word by word =====
        const words = fullContent.split(' ');
        let streamedContent = '';

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
          content: fullContent,
          tools_used: toolsUsed,
          timestamp: new Date().toISOString(),
          success: true
        }));

        console.log('✅ Stream complete');
      }

      if (message.type === 'clear') {
        conversationId = null;
        ws.send(JSON.stringify({
          type: 'cleared',
          content: 'Chat history cleared'
        }));
      }
    } catch (error) {
      console.error('WebSocket error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        content: `Error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log(`❌ Client disconnected: ${clientId}`);
    conversations.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'NBA Commentary Backend Running' });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🏀 NBA Commentary Backend running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});
