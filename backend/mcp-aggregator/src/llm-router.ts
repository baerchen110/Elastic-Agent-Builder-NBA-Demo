/**
 * LLM Router - Uses Claude Sonnet 4.5 for intelligent query routing
 *
 * This router leverages Claude's understanding to:
 * 1. Interpret natural language queries
 * 2. Select the right tools from available MCP servers
 * 3. Plan multi-step tool compositions
 * 4. Extract and validate parameters
 */

import Anthropic from '@anthropic-ai/sdk';
import { QueryIntent, QueryPlan, ToolCall, QueryRequest, MCPTool } from './types.js';
import { summarizeToolMetadata } from './tool-metadata.js';

interface ToolsMap {
  [serverId: string]: MCPTool[];
}

export class LLMRouter {
  private client: Anthropic;
  private availableTools: ToolsMap;

  constructor(apiKey: string, toolsMap: ToolsMap) {
    this.client = new Anthropic({ apiKey });
    this.availableTools = toolsMap;
  }

  /**
   * Build a formatted tool list for Claude
   */
  private buildToolList(): string {
    let list = '\n=== AVAILABLE TOOLS ===\n\n';

    for (const [serverId, tools] of Object.entries(this.availableTools)) {
      if (tools.length === 0) continue;

      list += `📦 Server: ${serverId}\n`;
      list += `${'─'.repeat(50)}\n\n`;

      for (const tool of tools) {
        const summary = summarizeToolMetadata(tool);
        list += `🔧 ${tool.name}\n`;
        if (tool.description) {
          list += `   Description: ${tool.description}\n`;
        }

        const tagLineParts: string[] = [];

        if (summary.labels.length > 0) {
          tagLineParts.push(`labels: ${summary.labels.join(', ')}`);
        }

        if (summary.categories.length > 0) {
          tagLineParts.push(`categories: ${summary.categories.join(', ')}`);
        }

        if (summary.derivedTags.length > 0) {
          tagLineParts.push(`derived: ${summary.derivedTags.join(', ')}`);
        }

        if (summary.synopsis) {
          list += `   Synopsis: ${summary.synopsis}\n`;
        }

        if (tagLineParts.length > 0) {
          list += `   Tags: ${tagLineParts.join(' | ')}\n`;
        }

        // Show required parameters
        if (tool.inputSchema?.required && tool.inputSchema.required.length > 0) {
          list += `   Required params: ${tool.inputSchema.required.join(', ')}\n`;
        }

        // Show available properties
        if (tool.inputSchema?.properties) {
          const props = Object.keys(tool.inputSchema.properties);
          if (props.length > 0) {
            list += `   Available params: ${props.join(', ')}\n`;
          }
        }
        list += '\n';
      }
      list += '\n';
    }

    return list;
  }

  /**
   * Build context about tool composition
   */
  private buildCompositionGuidance(): string {
    return `
=== TOOL COMPOSITION GUIDELINES ===

1. MULTI-STEP QUERIES:
   - Break complex queries into sequential tool calls
   - Example: "Compare LeBron and Curry" → [get LeBron stats, get Curry stats]

2. PARAMETER EXTRACTION:
   - Extract player names, team names, dates from the query
   - Convert natural language to API parameters
   - Example: "today" → date: "2025-11-06"

3. TOOL SELECTION STRATEGY:
   - Use Elasticsearch (elastic) for: semantic search, analytics, historical data
   - Use NBA MCP (nba) for: live games, player stats, team data, real-time info
  - Use Sentiment MCP (sentiment) for: fan buzz, social sentiment, Reddit/Twitter narratives
   - Prefer Elasticsearch for natural language understanding
   - Use NBA MCP for structured NBA data queries

4. PARAMETER VALIDATION:
   - ONLY call tools when you have ALL required parameters
   - If missing required params, use a search tool first to find them
   - Example: Need player_id? First call nba_list_active_players or platform_core_search
`;
  }

  /**
   * Route a query using Claude Sonnet 4.5
   */
  async routeQuery(request: QueryRequest): Promise<QueryPlan> {
    const { query, filters } = request;

    console.log('[LLM Router] Routing query with Claude Sonnet 4.5...');

    try {
      const toolList = this.buildToolList();
      const compositionGuidance = this.buildCompositionGuidance();

      const response = await this.client.messages.create({
        model: process.env.LLM_ROUTER_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: parseInt(process.env.LLM_ROUTER_MAX_TOKENS || '2000', 10),
        messages: [{
          role: 'user',
          content: `You are an expert query router for an NBA data system. Your job is to analyze queries and select the RIGHT tools to answer them.

${toolList}

${compositionGuidance}

USER QUERY: "${query}"

${filters ? `ADDITIONAL CONTEXT: ${JSON.stringify(filters, null, 2)}` : ''}

TASK: Generate a query execution plan as JSON:

{
  "intent": "PLAYER_STATS" | "LIVE_GAMES" | "ANALYTICS" | "PLAYER_SEARCH" | "TEAM_INFO" | "SENTIMENT" | "UNKNOWN",
  "tools": [
    {
      "serverId": "elastic" | "nba" | "balldontlie" | "sentiment",
      "toolName": "exact_tool_name_with_underscores",
      "parameters": { /* only include if you have all required params */ }
    }
  ],
  "playerNames": ["extracted player names if any"],
  "reasoning": "brief explanation of your tool selection"
}

CRITICAL RULES:
1. Use EXACT tool names from the list above (with underscores, not dots!)
2. Only include parameters if you're confident about their values
3. For multi-step queries, return multiple tool calls in order
4. Prefer Elasticsearch for semantic/natural language queries
5. Use NBA MCP for structured data (live scores, specific stats)
6. Use Sentiment MCP for social buzz or fan sentiment analysis when available
7. Return ONLY valid JSON, no other text

Your response:`
        }]
      });

      // Parse Claude's response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Expected text response from Claude');
      }

      const text = content.text;
      console.log('[LLM Router] Claude response:', text);

      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Claude response');
      }

      const plan = JSON.parse(jsonMatch[0]);

      // Validate the plan
      if (!plan.intent || !plan.tools || !Array.isArray(plan.tools)) {
        throw new Error('Invalid plan structure from Claude');
      }

      // Validate each tool call
      for (const tool of plan.tools) {
        if (!tool.serverId || !tool.toolName) {
          throw new Error(`Invalid tool call: ${JSON.stringify(tool)}`);
        }

        // Check if the tool exists
        const serverTools = this.availableTools[tool.serverId];
        if (!serverTools) {
          throw new Error(`Unknown server: ${tool.serverId}`);
        }

        const toolExists = serverTools.some(t => t.name === tool.toolName);
        if (!toolExists) {
          throw new Error(`Tool ${tool.toolName} not found on server ${tool.serverId}`);
        }
      }

      console.log('[LLM Router] Plan generated:', JSON.stringify(plan, null, 2));

      return {
        intent: plan.intent as QueryIntent,
        tools: plan.tools as ToolCall[],
        playerNames: plan.playerNames
      };

    } catch (error: any) {
      console.error('[LLM Router] Error:', error.message);

      // Fallback to simple routing if LLM fails
      console.log('[LLM Router] Falling back to simple routing...');
      return this.fallbackRouting(query);
    }
  }

  /**
   * Fallback routing when LLM fails
   */
  private fallbackRouting(query: string): QueryPlan {
    const queryLower = query.toLowerCase();
    const sentimentKeywords = /(sentiment|buzz|fans|twitter|reddit|social|vibe|narrative)/i;

    if (sentimentKeywords.test(queryLower) && Array.isArray(this.availableTools.sentiment) && this.availableTools.sentiment.length > 0) {
      return {
        intent: QueryIntent.SENTIMENT,
        tools: [{
          serverId: 'sentiment',
          toolName: 'get_combined_player_sentiment',
          parameters: {
            player_name: query,
            window_minutes: 180
          }
        }]
      };
    }

    // Default to Elasticsearch semantic search
    return {
      intent: QueryIntent.UNKNOWN,
      tools: [{
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: { query }
      }]
    };
  }

  /**
   * Update available tools (call this when servers connect/disconnect)
   */
  updateTools(toolsMap: ToolsMap): void {
    this.availableTools = toolsMap;
    console.log('[LLM Router] Tools updated');
  }
}
