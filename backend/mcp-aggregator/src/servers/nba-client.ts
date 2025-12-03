/**
 * NBA MCP Client
 * Connects to nba_mcp_server via stdio
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPTool } from '../types.js';
import * as path from 'path';

export class NBAMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  public connected: boolean = false;

  /**
   * Initialize connection to NBA MCP Server via stdio
   */
  async connect(): Promise<void> {
    try {
      console.log('[NBA MCP] Connecting to NBA MCP Server...');

      // Path to nba_server.py
      // Use environment variable if set, otherwise try to find it relative to cwd
      const serverPath = process.env.NBA_MCP_SERVER_PATH ||
                        path.join(process.cwd(), '../mcp-servers/nba-mcp-server/nba_server.py');

      console.log(`[NBA MCP] Server path: ${serverPath}`);

      // Use stdio transport to communicate with the Python server
      this.transport = new StdioClientTransport({
        command: 'python',
        args: [serverPath]
      });

      this.client = new Client({
        name: 'mcp-aggregator-nba-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);

      // List available tools
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools as MCPTool[];

      this.connected = true;
      console.log(`[NBA MCP] Connected! Found ${this.tools.length} tools`);
      console.log(`[NBA MCP] Tools:`, this.tools.map(t => t.name).join(', '));
    } catch (error) {
      this.connected = false;
      console.error('[NBA MCP] Connection failed:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to NBA MCP server');
    }

    return this.tools;
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to NBA MCP server');
    }

    try {
      console.log(`[NBA MCP] Calling tool: ${toolName}`);
      console.log(`[NBA MCP] Parameters:`, JSON.stringify(parameters, null, 2));

      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });

      console.log(`[NBA MCP] Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[NBA MCP] Tool ${toolName} failed:`, error);
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
        console.log('[NBA MCP] Disconnected');
      } catch (error) {
        console.error('[NBA MCP] Disconnect error:', error);
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

  /**
   * Get full tools with schemas
   */
  getTools(): MCPTool[] {
    return this.tools;
  }
}
