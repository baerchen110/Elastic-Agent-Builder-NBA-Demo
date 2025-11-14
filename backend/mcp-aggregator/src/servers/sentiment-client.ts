/**
 * Sentiment MCP Client
 * Connects to sentiment MCP server via stdio
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPTool } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SentimentMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  public connected = false;

  async connect(): Promise<void> {
    try {
      console.log('[Sentiment MCP] Connecting to sentiment server...');

      const serverPath = process.env.SENTIMENT_MCP_PATH ||
        path.resolve(__dirname, '../../../../mcp-servers/sentiment/dist/index.js');

      const envEntries = Object.entries(process.env ?? {}).map(([key, value]) => [key, value ?? '']);

      this.transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: Object.fromEntries(envEntries) as Record<string, string>
      });

      this.client = new Client({
        name: 'mcp-aggregator-sentiment-client',
        version: '0.1.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);

      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools as MCPTool[];
      this.connected = true;

      console.log(`[Sentiment MCP] Connected! Found ${this.tools.length} tools`);
    } catch (error) {
      this.connected = false;
      console.error('[Sentiment MCP] Connection failed:', error);
      throw error;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to Sentiment MCP server');
    }
    return this.tools;
  }

  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to Sentiment MCP server');
    }

    try {
      console.log(`[Sentiment MCP] Calling tool: ${toolName}`);
      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });
      return result;
    } catch (error) {
      console.error(`[Sentiment MCP] Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.close();
      this.connected = false;
      console.log('[Sentiment MCP] Disconnected');
    } catch (error) {
      console.error('[Sentiment MCP] Disconnect error:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getToolNames(): string[] {
    return this.tools.map(tool => tool.name);
  }

  getTools(): MCPTool[] {
    return this.tools;
  }
}
