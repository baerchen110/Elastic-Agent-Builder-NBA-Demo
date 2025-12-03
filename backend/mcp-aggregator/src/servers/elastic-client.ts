/**
 * Elastic Agent Builder MCP Client
 * Connects to Kibana Agent Builder via HTTP-based MCP using mcp-remote
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPTool } from '../types.js';
import { enrichElasticTools } from '../elastic-tool-enrichment.js';

export class ElasticMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  public connected: boolean = false;

  /**
   * Initialize connection to Elastic Agent Builder MCP via HTTP
   */
  async connect(): Promise<void> {
    try {
      console.log('[Elastic MCP] Connecting to Kibana Agent Builder...');

      const kibanaUrl = process.env.KIBANA_URL;
      const apiKey = process.env.ELASTICSEARCH_API_KEY;

      if (!kibanaUrl || !apiKey) {
        throw new Error('KIBANA_URL and ELASTICSEARCH_API_KEY must be set');
      }

      // Build the MCP endpoint URL
      // Remove trailing slash from kibanaUrl and add /api/agent_builder/mcp
      const baseUrl = kibanaUrl.replace(/\/$/, '');
      const mcpEndpoint = `${baseUrl}/api/agent_builder/mcp`;
      const authHeader = `ApiKey ${apiKey}`;

      console.log(`[Elastic MCP] Connecting to: ${mcpEndpoint}`);

      // Use mcp-remote for HTTP-based MCP connection
      // This requires mcp-remote to be installed: npm install -g mcp-remote
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '-y',
          'mcp-remote',
          mcpEndpoint,
          '--header',
          `Authorization:${authHeader}`
        ]
      });

      this.client = new Client({
        name: 'mcp-aggregator-elastic-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);

      // List available tools and enrich with metadata
      const toolsResponse = await this.client.listTools();
      const rawTools = toolsResponse.tools as MCPTool[];
      this.tools = enrichElasticTools(rawTools);

      this.connected = true;
      console.log(`[Elastic MCP] Connected! Found ${this.tools.length} tools`);
      console.log(`[Elastic MCP] Tools:`, this.tools.map(t => t.name).join(', '));

      const specializedCount = this.tools.filter(t => t.metadata?.priority === 'high').length;
      console.log(`[Elastic MCP] Specialized/curated tools: ${specializedCount}`);
    } catch (error) {
      this.connected = false;
      console.error('[Elastic MCP] Connection failed:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to Elastic MCP server');
    }

    return this.tools;
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to Elastic MCP server');
    }

    try {
      console.log(`[Elastic MCP] Calling tool: ${toolName}`);
      console.log(`[Elastic MCP] Parameters:`, JSON.stringify(parameters, null, 2));

      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });

      console.log(`[Elastic MCP] Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[Elastic MCP] Tool ${toolName} failed:`, error);
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
        console.log('[Elastic MCP] Disconnected');
      } catch (error) {
        console.error('[Elastic MCP] Disconnect error:', error);
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
   * Get all tools with metadata
   */
  getTools(): MCPTool[] {
    return this.tools;
  }
}
