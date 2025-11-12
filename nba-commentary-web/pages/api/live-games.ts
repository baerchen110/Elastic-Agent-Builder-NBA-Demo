/**
 * Live Games API Route
 * Fetches current live games and extracts player information
 */

import type { NextApiRequest, NextApiResponse } from 'next';

interface GameLeader {
  personId: number;
  name: string;
  jerseyNum: string;
  position: string;
  teamTricode: string;
  points: number;
  rebounds: number;
  assists: number;
}

interface Team {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  score: number;
  wins: number;
  losses: number;
}

interface NBAGame {
  gameId: string;
  gameStatus: number; // 1 = scheduled, 2 = live, 3 = final
  gameStatusText: string;
  homeTeam: Team;
  awayTeam: Team;
  gameLeaders?: {
    homeLeaders?: GameLeader;
    awayLeaders?: GameLeader;
  };
}

interface TransformedGame {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  topPlayers: Array<{
    name: string;
    team: string;
    points: number;
    rebounds: number;
    assists: number;
  }>;
  status: 'live' | 'upcoming' | 'final';
  statusText: string;
}

interface LiveGamesResponse {
  games: TransformedGame[];
  hasLiveGames: boolean;
  totalGames: number;
  error?: string;
}

/**
 * Transform raw NBA game data to simplified format
 */
function transformGamesData(rawGames: NBAGame[]): TransformedGame[] {
  return rawGames.map((game) => {
    const topPlayers: TransformedGame['topPlayers'] = [];

    // Add home team leader
    if (game.gameLeaders?.homeLeaders) {
      const leader = game.gameLeaders.homeLeaders;
      topPlayers.push({
        name: leader.name,
        team: `${game.homeTeam.teamCity} ${game.homeTeam.teamName}`,
        points: leader.points,
        rebounds: leader.rebounds,
        assists: leader.assists
      });
    }

    // Add away team leader
    if (game.gameLeaders?.awayLeaders) {
      const leader = game.gameLeaders.awayLeaders;
      topPlayers.push({
        name: leader.name,
        team: `${game.awayTeam.teamCity} ${game.awayTeam.teamName}`,
        points: leader.points,
        rebounds: leader.rebounds,
        assists: leader.assists
      });
    }

    // Determine game status
    let status: 'live' | 'upcoming' | 'final';
    if (game.gameStatus === 1) {
      status = 'upcoming';
    } else if (game.gameStatus === 2) {
      status = 'live';
    } else {
      status = 'final';
    }

    return {
      gameId: game.gameId,
      homeTeam: `${game.homeTeam.teamCity} ${game.homeTeam.teamName}`,
      awayTeam: `${game.awayTeam.teamCity} ${game.awayTeam.teamName}`,
      homeScore: game.homeTeam.score,
      awayScore: game.awayTeam.score,
      topPlayers,
      status,
      statusText: game.gameStatusText
    };
  });
}

/**
 * Parse games from MCP response
 */
function parseGamesFromMCPResponse(data: any): NBAGame[] {
  try {
    // MCP response structure: data.results.nba[0].content[0].text contains JSON string
    if (!data?.results?.nba?.[0]?.content?.[0]?.text) {
      console.warn('[Live Games] No NBA data in MCP response');
      return [];
    }

    const jsonText = data.results.nba[0].content[0].text;
    const parsed = JSON.parse(jsonText);

    // Extract games from scoreboard
    const games = parsed?.scoreboard?.games || [];
    console.log(`[Live Games] Found ${games.length} games`);

    return games as NBAGame[];
  } catch (error) {
    console.error('[Live Games] Error parsing MCP response:', error);
    return [];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LiveGamesResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      games: [],
      hasLiveGames: false,
      totalGames: 0,
      error: 'Method not allowed'
    });
  }

  try {
    console.log('[Live Games] Fetching current live games...');

    // Call MCP aggregator to get live games
    const response = await fetch('http://localhost:3000/api/mcp/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'get current live games',
        summarize: false // We don't need LLM summary for structured data
      }),
      // 10 second timeout
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`MCP API responded with status: ${response.status}`);
    }

    const mcpData = await response.json();

    if (!mcpData.success) {
      throw new Error(mcpData.error || 'MCP query failed');
    }

    // Parse raw games from MCP response
    const rawGames = parseGamesFromMCPResponse(mcpData.data);

    // Transform to simplified format
    const games = transformGamesData(rawGames);

    // Check if any games are actually live
    const liveGames = games.filter(g => g.status === 'live');
    const hasLiveGames = liveGames.length > 0;

    console.log(`[Live Games] Returning ${games.length} games (${liveGames.length} live)`);

    return res.status(200).json({
      games,
      hasLiveGames,
      totalGames: games.length
    });

  } catch (error: any) {
    // Handle timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error('[Live Games] Request timeout');
      return res.status(504).json({
        games: [],
        hasLiveGames: false,
        totalGames: 0,
        error: 'Request timeout - live games API took too long to respond'
      });
    }

    // Handle other errors
    console.error('[Live Games] Error:', error);
    return res.status(500).json({
      games: [],
      hasLiveGames: false,
      totalGames: 0,
      error: error.message || 'Failed to fetch live games'
    });
  }
}
