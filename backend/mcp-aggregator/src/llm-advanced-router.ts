import Anthropic from '@anthropic-ai/sdk';
import { QueryIntent, QueryPlan, QueryRequest, MCPTool, ToolCall } from './types.js';
import { routeQuery as staticRouteQuery } from './router.js';
import { summarizeToolMetadata } from './tool-metadata.js';
import { CodeExecutionEngine, CodeExecutionError } from './code-execution/executor.js';
import { parseAdvancedRouterResponse } from './llm-advanced-parser.js';
import { routerMetrics } from './router-metrics.js';

interface ToolsMap {
  [serverId: string]: MCPTool[];
}

interface ScratchpadCandidate {
  plan: QueryPlan;
  scratchpad: string;
  source: 'llm' | 'fallback';
  rawResponse?: string;
}

export type AdvancedRouterMode = 'experimental' | 'disabled';

export class LLMAdvancedRouter {
  private availableTools: ToolsMap;
  private mode: AdvancedRouterMode;
  private anthropic: Anthropic | null;
  private codeExecutor: CodeExecutionEngine;

  constructor(toolsMap: ToolsMap = {}, mode: AdvancedRouterMode = 'experimental') {
    this.availableTools = toolsMap;
    this.mode = mode;
    this.codeExecutor = new CodeExecutionEngine();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  }

  updateTools(toolsMap: ToolsMap): void {
    this.availableTools = toolsMap;
    console.log('[LLM Advanced Router] Tools updated');
  }

  setMode(mode: AdvancedRouterMode): void {
    this.mode = mode;
  }

  async routeQuery(request: QueryRequest): Promise<QueryPlan> {
    console.log('[LLM Advanced Router] Experimental router invoked');

    const candidate = this.anthropic
      ? await this.generatePlanWithLLM(request)
      : await this.generateFallbackPlan(request);

    let planForValidation = candidate.plan;
    let executionSucceeded = false;

    const executedPlan = await this.executeScratchpad(candidate, request);
    if (executedPlan) {
      planForValidation = executedPlan;
      executionSucceeded = true;
    }

    const { plan: guardedPlan, warnings, usedFallback } = this.enforceGuardrails(planForValidation, request);

    routerMetrics.logPlan({
      request,
      plan: guardedPlan,
      router: 'advanced',
      source: candidate.source,
      scratchpad: candidate.scratchpad,
      executionSucceeded,
      warnings,
      usedFallback
    });

    return guardedPlan;
  }

  getAvailableTools(): ToolsMap {
    return this.availableTools;
  }

  getMode(): AdvancedRouterMode {
    return this.mode;
  }

  private async generatePlanWithLLM(request: QueryRequest): Promise<ScratchpadCandidate> {
    try {
      const toolInventory = this.buildToolInventory();
      const { systemPrompt, userPrompt } = this.buildPrompt(request, toolInventory);

      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const textContent = response.content?.[0];
      if (!textContent || textContent.type !== 'text') {
        throw new Error('Unexpected response payload from Anthropic');
      }

      const parsed = parseAdvancedRouterResponse(textContent.text);
      return {
        plan: parsed.plan,
        scratchpad: parsed.scratchpad,
        source: 'llm',
        rawResponse: textContent.text
      };
    } catch (error: any) {
      console.warn('[LLM Advanced Router] LLM planning failed:', error?.message ?? error);
      return this.generateFallbackPlan(request, error?.message);
    }
  }

  private async generateFallbackPlan(request: QueryRequest, reason?: string): Promise<ScratchpadCandidate> {
    const staticPlan = staticRouteQuery(request);
    const scratchpad = this.buildStaticScratchpad(staticPlan);

    if (reason) {
      console.debug('[LLM Advanced Router] Using fallback plan:', reason);
    }

    return {
      plan: staticPlan,
      scratchpad,
      source: 'fallback'
    };
  }

  private async executeScratchpad(candidate: ScratchpadCandidate, request: QueryRequest): Promise<QueryPlan | null> {
    if (!candidate.scratchpad) {
      return null;
    }

    try {
      const plan = await this.codeExecutor.execute({
        code: candidate.scratchpad,
        request,
        toolsMap: this.availableTools
      });
      return plan;
    } catch (error) {
      if (error instanceof CodeExecutionError) {
        console.warn('[LLM Advanced Router] Scratchpad execution error:', error.message);
      } else {
        console.warn('[LLM Advanced Router] Scratchpad execution unexpected failure:', error);
      }
      return null;
    }
  }

  private buildStaticScratchpad(plan: QueryPlan): string {
    const serializedPlan = JSON.stringify(plan, null, 2);
    return `const plan = ${serializedPlan};\nreturn plan;`;
  }

  private buildToolInventory(): string {
    let output = '\n=== TOOL INVENTORY ===\n\n';

    for (const [serverId, tools] of Object.entries(this.availableTools)) {
      if (!tools || tools.length === 0) continue;

      output += `Server: ${serverId}\n`;
      output += `${'-'.repeat(40)}\n`;

      for (const tool of tools) {
        const summary = summarizeToolMetadata(tool);
        output += `- ${tool.name}\n`;
        output += `  Description: ${tool.description || '—'}\n`;
        if (summary.labels.length > 0 || summary.categories.length > 0 || summary.derivedTags.length > 0) {
          const tags = [
            summary.labels.length > 0 ? `labels: ${summary.labels.join(', ')}` : null,
            summary.categories.length > 0 ? `categories: ${summary.categories.join(', ')}` : null,
            summary.derivedTags.length > 0 ? `derived: ${summary.derivedTags.join(', ')}` : null
          ].filter(Boolean).join(' | ');
          output += `  Tags: ${tags}\n`;
        }

        if (tool.inputSchema?.required?.length) {
          output += `  Required params: ${tool.inputSchema.required.join(', ')}\n`;
        }
        if (tool.inputSchema?.properties) {
          output += `  Params: ${Object.keys(tool.inputSchema.properties).join(', ')}\n`;
        }
        output += '\n';
      }
    }

    return output;
  }

  private buildPrompt(request: QueryRequest, toolInventory: string) {
    const guidelines = this.buildGuidelines();
    const validIntents = Object.values(QueryIntent).join(' | ');
    const userPrompt = `User query: ${request.query}\n\nRequired output JSON:\n{\n  "plan": {\n    "intent": "${validIntents}",\n    "tools": [{\n      "serverId": "elastic|nba|balldontlie|sentiment",\n      "toolName": "<tool name>",\n      "parameters": {"key": "value"}\n    }]\n  },\n  "scratchpad": "<JavaScript code string that returns the plan when executed>"\n}\n\nIMPORTANT: Choose ONE intent from: ${validIntents}`;

    return {
      systemPrompt: `${guidelines}\n${toolInventory}`,
      userPrompt
    };
  }

  private buildGuidelines(): string {
    return `You are an expert routing planner for an NBA analytics assistant.\n\n` +
      `1. Analyse the query and produce a tool plan using available MCP tools.\n` +
      `2. Provide a JSON object containing the plan and a JavaScript scratchpad string.\n` +
      `3. The scratchpad will run in a sandbox with access to { request, tools, helpers }.\n` +
      `4. Use helpers.buildToolCall(serverId, toolName, parameters) to define tool calls.\n` +
      `5. Use helpers.buildPlan(intent, toolCalls) to construct the final plan.\n` +
      `6. Keep the scratchpad deterministic and side-effect free.\n` +
      `7. Prefer NBA tools for live or really recent data. Elastic search is the primary server for advanced stats and analytics.\n` +
      `8. Use the sentiment server for social buzz and narrative analysis when appropriate.\n` +
      `9. Ensure required parameters are present before emitting tool calls.\n` +
      `10. Respond with JSON only.\n\n` +
      `TOOL SELECTION STRATEGY (CRITICAL):\n` +
      `- ALWAYS prefer specialized tools (with "nba" or "enhanced" labels) over generic tools\n` +
      `- ALWAYS use at least one specialized tool when the query relates to player stats, comparisons, live games, player or team info\n` +
      `- For player stats queries: Use get_player_recent_games or current_season_analysis_efficiency (NOT platform_core_search)\n` +
      `- For player comparisons: Use compare_player_season_stats or compare_two_players_career (NOT platform_core_search)\n` +
      `- For live games: Use get_current_live_games (NOT platform_core_search)\n` +
      `- For game details: Use get_games_details (NOT platform_core_search)\n` +
      `- For analytics: Use analyze_win_loss_impact, clutch, home_away_performance, or team_head_to_head\n` +
      `- ONLY use platform_core_search as a LAST RESORT when no specialized tool matches the query\n` +
      `- Generic tools (labeled "generic"): platform_core_search, platform_core_execute_esql - use sparingly\n` +
      `- Specialized tools (labeled "nba", "enhanced"): get_player_recent_games, compare_player_season_stats, etc. - prefer these\n\n` +
      `INTENT SELECTION RULES:\n` +
      `- PLAYER_SEARCH: Queries asking to "find", "search for", or "locate" a specific player\n` +
      `- PLAYER_STATS: Queries about player performance, statistics, averages, or season data\n` +
      `- LIVE_GAMES: Queries about today's games, live scores, current matches, or ongoing games\n` +
      `- ANALYTICS: Queries asking for trends, analysis, comparisons, or insights\n` +
      `- SENTIMENT: Queries about fan reactions, social buzz, narratives, or public opinion\n` +
      `- TEAM_INFO: Queries about team rosters, schedules, standings, or team data\n` +
      `- UNKNOWN: Only use if query is ambiguous or cannot be classified\n\n` +
      `For queries with multiple aspects (e.g., "player stats + fan sentiment"), choose the PRIMARY intent based on what's asked first or emphasized most.`;
  }

  private enforceGuardrails(plan: QueryPlan, request: QueryRequest): { plan: QueryPlan; warnings: string[]; usedFallback: boolean } {
    const warnings: string[] = [];
    let useFallback = false;

    if (!plan.tools || plan.tools.length === 0) {
      warnings.push('Plan contained no tool calls');
      useFallback = true;
    }

    if (!useFallback) {
      for (const tool of plan.tools) {
        const definition = this.getToolDefinition(tool.serverId, tool.toolName);

        if (!definition) {
          warnings.push(`Tool ${tool.serverId}:${tool.toolName} is not available`);
          useFallback = true;
          break;
        }

        const required = definition.inputSchema?.required ?? [];
        const provided = tool.parameters || {};
        const missing = required.filter(param => provided[param] === undefined);

        if (missing.length > 0) {
          warnings.push(`Missing required parameters for ${tool.toolName}: ${missing.join(', ')}`);
          useFallback = true;
          break;
        }
      }
    }

    if (plan.intent === QueryIntent.PLAYER_STATS) {
      const hasStatsTool = plan.tools.some(tool => {
        const summary = this.getToolSummary(tool.serverId, tool.toolName);
        return summary?.derivedTags.includes('player_stats') || tool.serverId === 'nba';
      });

      if (!hasStatsTool) {
        warnings.push('PLAYER_STATS intent without dedicated stats tool');
      }
    }

    if (!useFallback && plan.intent === QueryIntent.SENTIMENT) {
      const hasSentimentTool = plan.tools.some(tool => tool.serverId === 'sentiment');
      if (!hasSentimentTool) {
        warnings.push('SENTIMENT intent must include at least one sentiment tool');
        useFallback = true;
      }
    }

    if (useFallback) {
      const fallbackPlan = staticRouteQuery(request);
      return {
        plan: fallbackPlan,
        warnings,
        usedFallback: true
      };
    }

    return {
      plan,
      warnings,
      usedFallback: false
    };
  }

  private getToolDefinition(serverId: string, toolName: string): MCPTool | undefined {
    const tools = this.availableTools[serverId];
    if (!tools) return undefined;
    return tools.find(tool => tool.name === toolName);
  }

  private getToolSummary(serverId: string, toolName: string) {
    const definition = this.getToolDefinition(serverId, toolName);
    if (!definition) return undefined;
    return summarizeToolMetadata(definition);
  }
}
