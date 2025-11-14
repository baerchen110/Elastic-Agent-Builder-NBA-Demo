#!/usr/bin/env node

/**
 * BallDontLie MCP Server
 * Provides NBA data via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { BallDontLieAPI } from './api-client.js';

// Initialize API client
const apiKey = process.env.BALLDONTLIE_API_KEY;
const api = new BallDontLieAPI(apiKey);

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'nba_get_players',
    description: 'Search for NBA players by name. Returns player information including team, position, and physical attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Player name to search for (e.g., "LeBron James", "Curry")'
        },
        per_page: {
          type: 'number',
          description: 'Number of results per page (default: 25)',
          default: 25
        }
      },
      required: []
    }
  },
  {
    name: 'nba_get_player_stats',
    description: 'Get season average statistics for a specific player. Returns PPG, RPG, APG, shooting percentages, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'number',
          description: 'The NBA player ID'
        },
        season: {
          type: 'number',
          description: 'The season year (e.g., 2024 for 2024-25 season)',
          default: 2024
        }
      },
      required: ['player_id']
    }
  },
  {
    name: 'nba_get_games',
    description: 'Get NBA games by date, season, or team. Returns game schedules, scores, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of dates in YYYY-MM-DD format (e.g., ["2024-01-15"])'
        },
        season: {
          type: 'number',
          description: 'The season year (e.g., 2024)'
        },
        team_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of team IDs to filter by'
        },
        per_page: {
          type: 'number',
          description: 'Number of results per page (default: 25)',
          default: 25
        }
      },
      required: []
    }
  },
  {
    name: 'nba_get_teams',
    description: 'Get all NBA teams with their conference, division, and location information.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Create MCP server
const server = new Server(
  {
    name: 'balldontlie-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'nba_get_players': {
        const players = await api.getPlayers({
          search: args?.search as string | undefined,
          per_page: (args?.per_page as number) || 25
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(players, null, 2)
            }
          ]
        };
      }

      case 'nba_get_player_stats': {
        if (!args?.player_id) {
          throw new Error('player_id is required');
        }

        const stats = await api.getSeasonAverages(
          args.player_id as number,
          args?.season as number | undefined
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }

      case 'nba_get_games': {
        const games = await api.getGames({
          dates: args?.dates as string[] | undefined,
          season: args?.season as number | undefined,
          team_ids: args?.team_ids as number[] | undefined,
          per_page: (args?.per_page as number) || 25
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(games, null, 2)
            }
          ]
        };
      }

      case 'nba_get_teams': {
        const teams = await api.getTeams();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(teams, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('BallDontLie MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
