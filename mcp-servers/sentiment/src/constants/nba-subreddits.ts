/**
 * NBA Subreddit and Player Name Constants
 * Used for targeted Reddit sentiment analysis
 */

/**
 * Default NBA-focused subreddits for general NBA discussion
 */
export const DEFAULT_NBA_SUBREDDITS = [
  'nba',
  'nbadiscussion',
  'fantasybball'
];

/**
 * Team-specific subreddits mapped to star players
 * Each player gets their team subreddit + r/nba for broader coverage
 */
export const TEAM_SUBREDDITS: Record<string, string[]> = {
  'Nikola Jokić': ['denvernuggets', 'nba'],
  'Giannis Antetokounmpo': ['mkebucks', 'nba'],
  'Shai Gilgeous-Alexander': ['thunder', 'nba'],
  'Luka Dončić': ['lakers', 'nba'],
  'Jayson Tatum': ['bostonceltics', 'nba'],
  'Joel Embiid': ['sixers', 'nba'],
  'Stephen Curry': ['warriors', 'nba'],
  'Kevin Durant': ['rockets', 'nba'],
  'Devin Booker': ['suns', 'nba'],
  'LeBron James': ['lakers', 'nba'],
  'Anthony Davis': ['lakers', 'nba'],
  'Kawhi Leonard': ['laclippers', 'nba'],
  'Paul George': ['laclippers', 'nba'],
  'Damian Lillard': ['mkebucks', 'ripcity', 'nba'],
  'Jimmy Butler': ['heat', 'nba'],
  'Bam Adebayo': ['heat', 'nba'],
  'Donovan Mitchell': ['clevelandcavs', 'nba'],
  'Trae Young': ['atlantahawks', 'nba'],
  'Ja Morant': ['memphisgrizzlies', 'nba'],
  'Zion Williamson': ['nolapelicans', 'nba'],
  'Brandon Ingram': ['nolapelicans', 'nba'],
  'De\'Aaron Fox': ['kings', 'nba'],
  'Domantas Sabonis': ['kings', 'nba'],
  'Tyrese Haliburton': ['pacers', 'nba'],
  'Paolo Banchero': ['orlandomagic', 'nba'],
  'Alperen Şengün': ['rockets', 'nba'],
  'Victor Wembanyama': ['nbaspurs', 'nba'],
  'Nikola Vučević': ['chicagobulls', 'nba'],
  'DeMar DeRozan': ['chicagobulls', 'nba']
};

/**
 * Player name variations for fuzzy matching
 * Helps match different ways fans refer to players on Reddit
 */
export const PLAYER_NAME_VARIATIONS: Record<string, string[]> = {
  'Nikola Jokić': ['Nikola Jokic', 'Jokic', 'Joker', 'Jokić'],
  'Luka Dončić': ['Luka Doncic', 'Doncic', 'Luka', 'Dončić'],
  'Giannis Antetokounmpo': ['Giannis', 'Greek Freak', 'Antetokounmpo'],
  'Shai Gilgeous-Alexander': ['SGA', 'Shai', 'Gilgeous-Alexander', 'Shai Gilgeous Alexander'],
  'LeBron James': ['LeBron', 'LBJ', 'King James', 'Bron'],
  'Stephen Curry': ['Steph Curry', 'Curry', 'Steph', 'Chef Curry'],
  'Kevin Durant': ['KD', 'Durant', 'Kevin'],
  'Joel Embiid': ['Embiid', 'Joel', 'The Process'],
  'Jayson Tatum': ['Tatum', 'Jayson'],
  'Devin Booker': ['Booker', 'Book', 'Devin'],
  'Damian Lillard': ['Dame', 'Lillard', 'Dame Lillard', 'Damian'],
  'Anthony Davis': ['AD', 'Davis', 'Anthony', 'The Brow'],
  'Kawhi Leonard': ['Kawhi', 'Leonard', 'The Klaw'],
  'Paul George': ['PG13', 'George', 'Paul', 'PG'],
  'Jimmy Butler': ['Jimmy', 'Butler', 'Buckets'],
  'Trae Young': ['Trae', 'Ice Trae', 'Young'],
  'Ja Morant': ['Ja', 'Morant'],
  'Zion Williamson': ['Zion', 'Williamson'],
  'De\'Aaron Fox': ['Fox', 'De\'Aaron', 'DeAaron Fox', 'Swipa'],
  'Tyrese Haliburton': ['Haliburton', 'Tyrese', 'Hali'],
  'Alperen Şengün': ['Sengun', 'Alperen Sengun', 'Şengün', 'Alpi']
};

/**
 * Get player-specific subreddits for targeted sentiment analysis
 * Returns team subreddits + r/nba if player is recognized
 * Otherwise returns default NBA subreddits
 */
export function getPlayerSubreddits(playerName: string): string[] {
  // Normalize the input name
  const normalizedInput = playerName.trim();

  // Direct match
  if (TEAM_SUBREDDITS[normalizedInput]) {
    return TEAM_SUBREDDITS[normalizedInput];
  }

  // Fuzzy match using variations
  for (const [canonicalName, variations] of Object.entries(PLAYER_NAME_VARIATIONS)) {
    const allNames = [canonicalName, ...variations];
    const matchFound = allNames.some(name =>
      name.toLowerCase() === normalizedInput.toLowerCase() ||
      normalizedInput.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(normalizedInput.toLowerCase())
    );

    if (matchFound && TEAM_SUBREDDITS[canonicalName]) {
      return TEAM_SUBREDDITS[canonicalName];
    }
  }

  // No match found, return default NBA subreddits
  return DEFAULT_NBA_SUBREDDITS;
}

/**
 * Get search query variations for a player name
 * Returns all name variations to search for broader coverage
 */
export function getPlayerSearchTerms(playerName: string): string[] {
  const normalizedInput = playerName.trim();

  // Direct match in variations
  for (const [canonicalName, variations] of Object.entries(PLAYER_NAME_VARIATIONS)) {
    if (canonicalName.toLowerCase() === normalizedInput.toLowerCase()) {
      return [canonicalName, ...variations];
    }

    // Check if input matches any variation
    if (variations.some(v => v.toLowerCase() === normalizedInput.toLowerCase())) {
      return [canonicalName, ...variations];
    }
  }

  // No variations found, return original
  return [normalizedInput];
}

/**
 * Enhanced search: combine multiple search terms with OR logic
 * Reddit search supports OR operator: "LeBron OR LBJ OR King James"
 */
export function buildRedditSearchQuery(playerName: string): string {
  const terms = getPlayerSearchTerms(playerName);

  // For single term, return as is
  if (terms.length === 1) {
    return terms[0];
  }

  // For multiple terms, use OR operator
  // Wrap multi-word terms in quotes
  const quotedTerms = terms.map(term =>
    term.includes(' ') ? `"${term}"` : term
  );

  return quotedTerms.join(' OR ');
}
