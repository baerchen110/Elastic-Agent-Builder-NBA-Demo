/**
 * Elastic Tool Metadata Enrichment
 * Adds labels, categories, and descriptions to Elastic MCP tools
 */

import { MCPTool } from './types.js';

interface ToolEnrichment {
  description?: string;
  labels?: string[];
  categories?: string[];
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Metadata for curated NBA-specific tools from Elastic Agent Builder
 * These are specialized, enhanced tools that should be prioritized over generic ones
 */
const ELASTIC_TOOL_ENRICHMENTS: Record<string, ToolEnrichment> = {
  // NBA-specific curated tools (HIGH PRIORITY - specialized)
  'get_player_career_stats': {
    description: 'Get comprehensive career statistics for an NBA player including points, assists, rebounds, and shooting percentages',
    labels: ['nba', 'enhanced', 'player_stats'],
    categories: ['statistics', 'curated'],
    priority: 'high'
  },
  'get_player_recent_games': {
    description: 'Get recent game-by-game performance logs for an NBA player',
    labels: ['nba', 'enhanced', 'player_stats', 'recent'],
    categories: ['statistics', 'curated'],
    priority: 'high'
  },
  'compare_active_players': {
    description: 'Compare performance metrics between multiple active NBA players',
    labels: ['nba', 'enhanced', 'player_comparison'],
    categories: ['analytics', 'curated'],
    priority: 'high'
  },
  'compare_two_players_career': {
    description: 'Side-by-side career comparison of two NBA players',
    labels: ['nba', 'enhanced', 'player_comparison'],
    categories: ['analytics', 'curated'],
    priority: 'high'
  },
  'get_live_nba_games': {
    description: 'Get live scores and status of current NBA games',
    labels: ['nba', 'enhanced', 'live_games'],
    categories: ['real-time', 'curated'],
    priority: 'high'
  },
  'get_games_details': {
    description: 'Get detailed information about specific NBA games including box scores and player performances',
    labels: ['nba', 'enhanced', 'game_details'],
    categories: ['statistics', 'curated'],
    priority: 'high'
  },
  'analyze_win_loss_impact': {
    description: 'Analyze how player performance correlates with team wins and losses',
    labels: ['nba', 'enhanced', 'analytics'],
    categories: ['analytics', 'curated'],
    priority: 'high'
  },
  'clutch': {
    description: 'Analyze player performance in clutch situations (final minutes of close games)',
    labels: ['nba', 'enhanced', 'analytics', 'clutch'],
    categories: ['analytics', 'curated'],
    priority: 'high'
  },
  'home_away_performance': {
    description: 'Compare player performance statistics at home vs away games',
    labels: ['nba', 'enhanced', 'analytics'],
    categories: ['analytics', 'curated'],
    priority: 'high'
  },
  'team_head_to_head': {
    description: 'Analyze head-to-head matchups between NBA teams',
    labels: ['nba', 'enhanced', 'team_stats'],
    categories: ['analytics', 'curated'],
    priority: 'high'
  },

  // Platform core tools (MEDIUM PRIORITY - flexible but generic)
  'platform_core_search': {
    description: 'Semantic search across all indexed NBA data using natural language queries',
    labels: ['semantic_search', 'generic'],
    categories: ['search'],
    priority: 'medium'
  },
  'platform_core_execute_esql': {
    description: 'Execute ES|QL queries directly against Elasticsearch indices',
    labels: ['esql', 'advanced', 'generic'],
    categories: ['query'],
    priority: 'medium'
  },
  'platform_core_generate_esql': {
    description: 'Generate ES|QL query from natural language description',
    labels: ['esql', 'ai', 'generic'],
    categories: ['query'],
    priority: 'medium'
  },

  // Platform utility tools (LOW PRIORITY - infrastructure/debugging)
  'platform_core_get_document_by_id': {
    description: 'Retrieve a specific document by its ID from an Elasticsearch index',
    labels: ['utility', 'generic'],
    categories: ['infrastructure'],
    priority: 'low'
  },
  'platform_core_get_index_mapping': {
    description: 'Get the field mapping schema for an Elasticsearch index',
    labels: ['utility', 'generic'],
    categories: ['infrastructure'],
    priority: 'low'
  },
  'platform_core_list_indices': {
    description: 'List all available Elasticsearch indices',
    labels: ['utility', 'generic'],
    categories: ['infrastructure'],
    priority: 'low'
  },
  'platform_core_index_explorer': {
    description: 'Explore index structure and sample documents',
    labels: ['utility', 'generic'],
    categories: ['infrastructure'],
    priority: 'low'
  }
};

/**
 * Enrich Elastic MCP tools with metadata
 */
export function enrichElasticTools(tools: MCPTool[]): MCPTool[] {
  return tools.map(tool => {
    const enrichment = ELASTIC_TOOL_ENRICHMENTS[tool.name];

    if (!enrichment) {
      // Unknown tool - return as-is
      return tool;
    }

    return {
      ...tool,
      description: enrichment.description || tool.description,
      metadata: {
        ...(tool.metadata || {}),
        labels: enrichment.labels || [],
        categories: enrichment.categories || [],
        priority: enrichment.priority || 'medium'
      }
    };
  });
}

/**
 * Check if a tool is a specialized/curated NBA tool
 */
export function isSpecializedTool(toolName: string): boolean {
  const enrichment = ELASTIC_TOOL_ENRICHMENTS[toolName];
  return enrichment?.priority === 'high' && enrichment.labels?.includes('nba') === true;
}

/**
 * Check if a tool is generic/platform tool
 */
export function isGenericTool(toolName: string): boolean {
  const enrichment = ELASTIC_TOOL_ENRICHMENTS[toolName];
  return enrichment?.labels?.includes('generic') === true;
}

/**
 * Get tool priority score (higher is better)
 */
export function getToolPriorityScore(toolName: string): number {
  const enrichment = ELASTIC_TOOL_ENRICHMENTS[toolName];
  if (!enrichment) return 0;

  const priorityScores = {
    'high': 100,
    'medium': 50,
    'low': 10
  };

  return priorityScores[enrichment.priority || 'medium'];
}
