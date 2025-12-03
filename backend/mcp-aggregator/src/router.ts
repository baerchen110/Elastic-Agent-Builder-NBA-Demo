/**
 * Query Router - Intelligent intent classification and tool planning
 *
 * Routing Strategy:
 * - Elasticsearch: Primary for semantic search, analytics, historical data
 * - NBA MCP/BallDontLie: Real-time data only (live games, current rosters)
 */

import { QueryIntent, QueryPlan, ToolCall, QueryRequest } from './types.js';

// Determine which NBA server to use based on feature flag
const NBA_SERVER_ID = process.env.USE_NBA_MCP_SERVER === 'true' ? 'nba' : 'balldontlie';
const SENTIMENT_SERVER_ENABLED = process.env.USE_SENTIMENT_MCP_SERVER === 'true';

// Tool name mappings for different NBA servers
const NBA_TOOLS = {
  balldontlie: {
    getGames: 'nba_get_games',
    getPlayerStats: 'nba_get_player_stats',
    getTeams: 'nba_get_teams'
  },
  nba: {
    getGames: 'nba_list_todays_games',
    getPlayerStats: 'nba_player_career_stats',
    getTeams: 'nba_all_teams_stats'
  }
};

// Get the correct tool names based on active server
const TOOLS = NBA_TOOLS[NBA_SERVER_ID];

/**
 * Extract player names from query text
 */
function extractPlayerNames(query: string): string[] {
  const playerNames: string[] = [];
  const commonPlayers = [
    'LeBron James',
    'Nikola Jokic',
    'Stephen Curry',
    'Luka Doncic',
    'Giannis Antetokounmpo',
    'Jayson Tatum',
    'Joel Embiid',
    'Anthony Edwards',
    'Shai Gilgeous-Alexander',
    'Damian Lillard'
  ];

  const queryLower = query.toLowerCase();

  for (const player of commonPlayers) {
    const playerLower = player.toLowerCase();
    const firstName = playerLower.split(' ')[0];
    const lastName = playerLower.split(' ').slice(1).join(' ');

    // Check for full name, first name, or last name
    if (queryLower.includes(playerLower) ||
        queryLower.includes(firstName) ||
        queryLower.includes(lastName)) {
      playerNames.push(player);
    }
  }

  return playerNames;
}

/**
 * Classify query intent based on keywords
 */
function classifyIntent(query: string): QueryIntent {
  const queryLower = query.toLowerCase();

  if (/(sentiment|buzz|fans|twitter|reddit|social|narrative|hype|vibe)/i.test(queryLower)) {
    return QueryIntent.SENTIMENT;
  }

  // Player stats keywords
  if (/(stats|statistics|points|ppg|rpg|apg|averag|performance|season|scoring)/i.test(queryLower)) {
    return QueryIntent.PLAYER_STATS;
  }

  // Live games keywords
  if (/(live|today|tonight|current|score|game|playing|now)/i.test(queryLower)) {
    return QueryIntent.LIVE_GAMES;
  }

  // Analytics keywords
  if (/(analyz|predict|trend|forecast|comparison|compare|versus|vs)/i.test(queryLower)) {
    return QueryIntent.ANALYTICS;
  }

  // Team info keywords
  if (/(team|roster|lineup|squad)/i.test(queryLower)) {
    return QueryIntent.TEAM_INFO;
  }

  // Player search keywords
  if (/(find|search|who is|who are|player|info|information)/i.test(queryLower)) {
    return QueryIntent.PLAYER_SEARCH;
  }

  return QueryIntent.UNKNOWN;
}

/**
 * Determine if query requires real-time data
 */
function requiresRealTimeData(query: string): boolean {
  const realTimeKeywords = /(live|today|tonight|current|now|ongoing|right now|this moment)/i;
  return realTimeKeywords.test(query);
}

/**
 * Plan which tools to call based on intent - INTELLIGENT ROUTING
 */
function planTools(intent: QueryIntent, query: string, filters?: Record<string, any>): ToolCall[] {
  const tools: ToolCall[] = [];
  const queryLower = query.toLowerCase();
  const playerNames = extractPlayerNames(query);
  const needsRealTime = requiresRealTimeData(query);

  switch (intent) {
    case QueryIntent.PLAYER_SEARCH:
    case QueryIntent.PLAYER_STATS:
    case QueryIntent.ANALYTICS:
      // PRIMARY: Use Elasticsearch semantic search for natural language queries
      // This leverages ES's semantic capabilities for better results
      tools.push({
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: {
          query: query
        }
      });

      // SECONDARY: Add specific tools if we have structured data
      if (filters?.playerId && filters?.seasonType) {
        // If we have player_id, get detailed career stats from Elasticsearch
        tools.push({
          serverId: 'elastic',
          toolName: 'get_player_career_stats',
          parameters: {
            player_id: filters.playerId,
            season_type: filters.seasonType
          }
        });
      }

      // OPTIONAL: Add NBA MCP/BallDontLie for current season data if needed
      if (needsRealTime && filters?.playerId) {
        tools.push({
          serverId: NBA_SERVER_ID,
          toolName: TOOLS.getPlayerStats,
          parameters: {
            player_id: filters.playerId,
            season_type: filters.seasonType || 'Regular Season'
          }
        });
      }
      break;

    case QueryIntent.SENTIMENT: {
      if (!SENTIMENT_SERVER_ENABLED) {
        tools.push({
          serverId: 'elastic',
          toolName: 'platform_core_search',
          parameters: {
            query
          }
        });
        break;
      }

      const subject = typeof filters?.subject === 'string'
        ? filters.subject
        : playerNames.length > 0
          ? playerNames.join(' & ')
          : query;

      const windowMinutes = typeof filters?.window_minutes === 'number'
        ? filters.window_minutes
        : 180;

      const maxSamples = typeof filters?.max_samples === 'number'
        ? filters.max_samples
        : undefined;

      const sourcesFromFilters = Array.isArray(filters?.sources)
        ? filters.sources.filter(Boolean)
        : undefined;

      const sharedParams = buildSentimentParameters(subject, windowMinutes, maxSamples);

      tools.push({
        serverId: 'sentiment',
        toolName: 'get_combined_player_sentiment',
        parameters: {
          ...sharedParams,
          ...(sourcesFromFilters ? { sources: sourcesFromFilters } : {})
        }
      });

      if (sourcesFromFilters?.includes('twitter') || /twitter|\bx\b|tweet/i.test(queryLower)) {
        tools.push({
          serverId: 'sentiment',
          toolName: 'get_twitter_player_sentiment',
          parameters: sharedParams
        });
      }

      if (sourcesFromFilters?.includes('reddit') || /reddit|subreddit|r\//i.test(queryLower)) {
        tools.push({
          serverId: 'sentiment',
          toolName: 'get_reddit_player_sentiment',
          parameters: {
            ...sharedParams,
            ...(Array.isArray(filters?.subreddits) ? { subreddits: filters.subreddits } : {})
          }
        });
      }

      tools.push({
        serverId: 'sentiment',
        toolName: 'analyze_player_narrative_trend',
        parameters: {
          player_name: subject
        }
      });

      const timeframeForCompare = typeof (sharedParams as any).timeframe === 'string'
        ? (sharedParams as any).timeframe as string
        : undefined;
      const windowForCompare = typeof (sharedParams as any).window_minutes === 'number'
        ? (sharedParams as any).window_minutes as number
        : undefined;
      const limitForCompare = typeof (sharedParams as any).limit === 'number'
        ? (sharedParams as any).limit as number
        : undefined;

      if (playerNames.length >= 2) {
        tools.push({
          serverId: 'sentiment',
          toolName: 'compare_players_sentiment',
          parameters: {
            player1_name: playerNames[0],
            player2_name: playerNames[1],
            ...(timeframeForCompare ? { timeframe: timeframeForCompare } : {}),
            ...(windowForCompare ? { window_minutes: windowForCompare } : {}),
            ...(limitForCompare ? { limit: limitForCompare } : {})
          }
        });
      }

      if (/momentum|shift|swing|trend/i.test(queryLower)) {
        tools.push({
          serverId: 'sentiment',
          toolName: 'detect_narrative_shift',
          parameters: {
            player_name: subject
          }
        });
      }

      break;
    }

    case QueryIntent.LIVE_GAMES:
      // For live games, use NBA MCP/BallDontLie (real-time data source)
      const todayDate = new Date().toISOString().split('T')[0];
      const gameParams = NBA_SERVER_ID === 'balldontlie'
        ? { dates: [todayDate] }
        : { game_date: todayDate, league_id: "00" };

      tools.push({
        serverId: NBA_SERVER_ID,
        toolName: TOOLS.getGames,
        parameters: gameParams
      });

      // Also search Elasticsearch for historical context if needed
      if (!needsRealTime) {
        tools.push({
          serverId: 'elastic',
          toolName: 'platform_core_search',
          parameters: {
            query: query
          }
        });
      }
      break;

    case QueryIntent.TEAM_INFO:
      // PRIMARY: Use Elasticsearch for team analysis
      tools.push({
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: {
          query: query
        }
      });

      // SECONDARY: Get current roster from NBA MCP/BallDontLie if real-time needed
      if (needsRealTime) {
        tools.push({
          serverId: NBA_SERVER_ID,
          toolName: TOOLS.getTeams,
          parameters: {}
        });
      }
      break;

    default:
      // DEFAULT: Use Elasticsearch semantic search for any unknown query
      // This is the intelligent default - let ES figure out what the user wants
      tools.push({
        serverId: 'elastic',
        toolName: 'platform_core_search',
        parameters: {
          query: query
        }
      });
      break;
  }

  return tools;
}

/**
 * Route a query and create an execution plan
 */
export function routeQuery(request: QueryRequest): QueryPlan {
  const { query, filters } = request;

  const intent = classifyIntent(query);
  const tools = planTools(intent, query, filters);
  const playerNames = extractPlayerNames(query);

  return {
    intent,
    tools,
    playerNames: playerNames.length > 0 ? playerNames : undefined
  };
}

function buildSentimentParameters(subject: string, windowMinutes: number, maxSamples?: number): Record<string, unknown> {
  const params: Record<string, unknown> = {
    player_name: subject
  };

  const timeframe = mapWindowToTimeframe(windowMinutes);
  if (timeframe) {
    params.timeframe = timeframe;
  } else {
    params.window_minutes = windowMinutes;
  }

  if (typeof maxSamples === 'number') {
    params.limit = maxSamples;
  }

  return params;
}

function mapWindowToTimeframe(windowMinutes: number): string | undefined {
  switch (windowMinutes) {
    case 60:
      return '1h';
    case 180:
      return undefined; // too granular for preset labels
    case 720:
      return '12h';
    case 1_440:
      return '24h';
    case 10_080:
      return '7d';
    case 43_200:
      return '30d';
    default:
      return undefined;
  }
}
