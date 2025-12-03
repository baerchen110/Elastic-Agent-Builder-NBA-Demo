/**
 * Dynamic Sample Queries Generator
 * Generates contextual queries based on live game data
 */

export interface LiveGame {
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

export interface Player {
  name: string;
  team: string;
  points: number;
  rebounds: number;
  assists: number;
}

/**
 * Generate dynamic sample queries based on live game data
 * Returns 4-6 queries that mix stats, sentiment, and comparison types
 */
export function generateSampleQueries(games: LiveGame[]): string[] {
  // If no games, return default queries
  if (!games || games.length === 0) {
    return getDefaultQueries();
  }

  const queries: string[] = [];
  const players = extractTopPlayers(games);
  const liveGames = games.filter(g => g.status === 'live');

  // 1. Stats + Sentiment query for top performer
  if (players[0]) {
    queries.push(
      `What are ${players[0].name}'s stats since the beginning of the season? Are fans excited by what he demonstrated so far?`
    );
  }

  // 2. Team matchup sentiment (prioritize live games)
  const targetGame = liveGames[0] || games[0];
  if (targetGame) {
    queries.push(
      `What are fans saying about ${targetGame.homeTeam} vs ${targetGame.awayTeam}?`
    );
  }

  // 3. Player comparison
  if (players[0] && players[1]) {
    queries.push(
      `Compare ${players[0].name} and ${players[1].name}'s performance this season`
    );
  }

  // 4. Live game specific query (if games are live)
  if (liveGames.length > 0 && players[0]) {
    queries.push(
      `How is ${players[0].name} performing in tonight's game?`
    );
  }

  // 5. Team performance + sentiment
  if (games[1]) {
    const team = extractTeamName(games[1].homeTeam);
    queries.push(
      `How are the ${team} doing this season? What do fans think?`
    );
  }

  // 6. Hot take / trending query
  if (players[2]) {
    queries.push(
      `What are the hottest takes about ${players[2].name} right now?`
    );
  }

  // Return up to 6 queries, ensuring we have at least 4
  const finalQueries = queries.slice(0, 6);

  // Fill with defaults if we don't have enough
  while (finalQueries.length < 4) {
    const defaults = getDefaultQueries();
    finalQueries.push(defaults[finalQueries.length % defaults.length]);
  }

  return finalQueries;
}

/**
 * Extract and prioritize top players from games
 * Returns up to 6 players, prioritizing:
 * 1. Players from live games
 * 2. Highest scorers
 */
function extractTopPlayers(games: LiveGame[]): Player[] {
  const allPlayers: Player[] = [];

  // Extract all players with game context
  games.forEach(game => {
    game.topPlayers.forEach(player => {
      allPlayers.push({
        ...player,
        // Boost priority for live games
        points: game.status === 'live' ? player.points + 100 : player.points
      });
    });
  });

  // Sort by points (descending) and return unique players
  const sortedPlayers = allPlayers
    .sort((a, b) => b.points - a.points)
    .map(p => ({
      ...p,
      // Remove the boost for final output
      points: p.points > 100 ? p.points - 100 : p.points
    }));

  // Remove duplicates by name
  const uniquePlayers = sortedPlayers.filter((player, index, self) =>
    index === self.findIndex(p => p.name === player.name)
  );

  return uniquePlayers.slice(0, 6);
}

/**
 * Extract team name from full team string
 * "Los Angeles Lakers" -> "Lakers"
 * "Charlotte Hornets" -> "Hornets"
 */
function extractTeamName(fullTeam: string): string {
  const parts = fullTeam.split(' ');
  return parts[parts.length - 1];
}

/**
 * Default queries when no live games are available
 * Features popular players and general NBA topics
 */
function getDefaultQueries(): string[] {
  return [
    "What are LeBron James's stats this season? Are fans excited by what he demonstrated so far?",
    "How is Stephen Curry performing this year?",
    "What are fans saying about the Lakers?",
    "Compare Giannis Antetokounmpo and Nikola Jokić's MVP chances",
    "What are the hottest takes about Kevin Durant right now?",
    "How are the Celtics doing this season? What do fans think?"
  ];
}

/**
 * Generate queries with specific focus
 * Useful for themed query sets
 */
export function generateThemedQueries(
  games: LiveGame[],
  theme: 'stats' | 'sentiment' | 'comparison' | 'mixed'
): string[] {
  if (!games || games.length === 0) {
    return getDefaultQueries();
  }

  const players = extractTopPlayers(games);
  const queries: string[] = [];

  switch (theme) {
    case 'stats':
      queries.push(
        `What are ${players[0]?.name || 'LeBron James'}'s season stats?`,
        `Show me ${players[1]?.name || 'Stephen Curry'}'s performance breakdown`,
        `How many points per game is ${players[2]?.name || 'Giannis Antetokounmpo'} averaging?`
      );
      break;

    case 'sentiment':
      queries.push(
        `What are fans saying about ${players[0]?.name || 'LeBron James'}?`,
        `Are fans excited about ${games[0]?.homeTeam || 'the Lakers'}?`,
        `What do people think about ${players[1]?.name || 'Stephen Curry'}'s performance?`
      );
      break;

    case 'comparison':
      queries.push(
        `Compare ${players[0]?.name || 'LeBron James'} and ${players[1]?.name || 'Kevin Durant'}`,
        `${players[2]?.name || 'Giannis Antetokounmpo'} vs ${players[3]?.name || 'Nikola Jokić'} - who's better?`,
        `Which team is stronger: ${games[0]?.homeTeam || 'Lakers'} or ${games[1]?.awayTeam || 'Celtics'}?`
      );
      break;

    case 'mixed':
    default:
      return generateSampleQueries(games);
  }

  return queries.slice(0, 6);
}

/**
 * Get contextual query based on game status
 */
export function getContextualQuery(game: LiveGame): string {
  const topPlayer = game.topPlayers[0];

  if (!topPlayer) {
    return `What are fans saying about ${game.homeTeam} vs ${game.awayTeam}?`;
  }

  switch (game.status) {
    case 'live':
      return `How is ${topPlayer.name} performing in the live ${game.homeTeam} vs ${game.awayTeam} game?`;

    case 'upcoming':
      return `What are the predictions for ${game.homeTeam} vs ${game.awayTeam}?`;

    case 'final':
      return `${topPlayer.name} scored ${topPlayer.points} points - what are fans saying?`;

    default:
      return `What are fans saying about ${game.homeTeam} vs ${game.awayTeam}?`;
  }
}

/**
 * Shuffle queries for variety
 */
export function shuffleQueries(queries: string[]): string[] {
  const shuffled = [...queries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
