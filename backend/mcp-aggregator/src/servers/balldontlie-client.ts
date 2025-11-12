/**
 * BallDontLie MCP Client
 * Connects to local BallDontLie MCP server via stdio
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPTool } from '../types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BallDontLieMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  public connected: boolean = false;

  /**
   * Initialize connection to BallDontLie MCP server
   */
  async connect(): Promise<void> {
    try {
      console.log('[BallDontLie MCP] Connecting to BallDontLie server...');

      const apiKey = process.env.BALLDONTLIE_API_KEY;

      // Path to the built MCP server
      const serverPath = path.resolve(__dirname, '../../../../mcp-servers/balldontlie/dist/index.js');

      // Create stdio transport to local MCP server
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: {
          ...process.env,
          BALLDONTLIE_API_KEY: apiKey || ''
        }
      });

      this.client = new Client({
        name: 'mcp-aggregator-balldontlie-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);

      // List available tools
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools as MCPTool[];

      this.connected = true;
      console.log(`[BallDontLie MCP] Connected! Found ${this.tools.length} tools`);
      console.log(`[BallDontLie MCP] Tools:`, this.tools.map(t => t.name).join(', '));
    } catch (error) {
      this.connected = false;
      console.error('[BallDontLie MCP] Connection failed:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to BallDontLie MCP server');
    }

    return this.tools;
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to BallDontLie MCP server');
    }

    try {
      console.log(`[BallDontLie MCP] Calling tool: ${toolName}`);
      console.log(`[BallDontLie MCP] Parameters:`, JSON.stringify(parameters, null, 2));

      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });

      console.log(`[BallDontLie MCP] Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[BallDontLie MCP] Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.connected = false;
        console.log('[BallDontLie MCP] Disconnected');
      } catch (error) {
        console.error('[BallDontLie MCP] Disconnect error:', error);
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get available tool names
   */
  getToolNames(): string[] {
    return this.tools.map(t => t.name);
  }
}
