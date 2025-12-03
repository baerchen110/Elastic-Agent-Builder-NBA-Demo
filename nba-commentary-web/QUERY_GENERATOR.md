# Sample Queries Generator

## Overview
Dynamic query generator that creates contextual sample queries based on live NBA game data.

---

## Features

### 🎯 Dynamic Query Generation
- Uses **real player names** from live games
- Adapts to game status (live, upcoming, final)
- Falls back to **default popular players** when no games available

### 📊 Query Variety
Generates 3 types of queries:
1. **Stats Queries** - Player performance and statistics
2. **Sentiment Queries** - Fan reactions and opinions
3. **Comparison Queries** - Player and team matchups

### 🔀 Multiple Modes
- **Mixed Mode** (default) - Combines all query types
- **Themed Modes** - Focus on specific query types
- **Contextual Queries** - Game-specific questions
- **Shuffled Queries** - Random order for variety

---

## Usage

### Basic Usage

```typescript
import { generateSampleQueries } from '@/lib/query-generator';

// Fetch live games
const response = await fetch('/api/live-games');
const { games } = await response.json();

// Generate queries
const queries = generateSampleQueries(games);

// Use in UI
queries.forEach(query => {
  console.log(query);
});
```

### With Live Game Data

```typescript
// Returns 4-6 contextual queries using real player names
const queries = generateSampleQueries(liveGames);

// Example output:
// 1. What are Cade Cunningham's stats since the beginning of the season?
// 2. What are fans saying about Charlotte Hornets vs Los Angeles Lakers?
// 3. Compare Cade Cunningham and CJ McCollum's performance this season
// 4. How is Luka Dončić performing in tonight's game?
```

### With No Games (Fallback)

```typescript
// Returns default queries with popular players
const queries = generateSampleQueries([]);

// Example output:
// 1. What are LeBron James's stats this season?
// 2. How is Stephen Curry performing this year?
// 3. What are fans saying about the Lakers?
// 4. Compare Giannis Antetokounmpo and Nikola Jokić's MVP chances
```

---

## API Reference

### `generateSampleQueries(games: LiveGame[]): string[]`

Generates 4-6 dynamic sample queries based on live game data.

**Parameters:**
- `games` - Array of live game objects from `/api/live-games`

**Returns:**
- Array of 4-6 query strings

**Query Priority:**
1. Players from live games (boosted)
2. Highest scoring players
3. Recent games
4. Popular teams

**Example:**
```typescript
const queries = generateSampleQueries(games);
// Returns: ['What are Cade Cunningham's stats...', ...]
```

---

### `generateThemedQueries(games: LiveGame[], theme: 'stats' | 'sentiment' | 'comparison' | 'mixed'): string[]`

Generates queries focused on a specific theme.

**Parameters:**
- `games` - Array of live game objects
- `theme` - Query focus type

**Returns:**
- Array of themed query strings

**Example:**
```typescript
// Stats-focused queries
const statsQueries = generateThemedQueries(games, 'stats');
// ['What are Luka Dončić's season stats?', ...]

// Sentiment-focused queries
const sentimentQueries = generateThemedQueries(games, 'sentiment');
// ['What are fans saying about Luka Dončić?', ...]

// Comparison queries
const comparisonQueries = generateThemedQueries(games, 'comparison');
// ['Compare Luka Dončić and Miles Bridges', ...]
```

---

### `getContextualQuery(game: LiveGame): string`

Generates a single contextual query for a specific game.

**Parameters:**
- `game` - Single game object

**Returns:**
- Single query string tailored to game status

**Example:**
```typescript
// Live game
const query = getContextualQuery(liveGame);
// 'How is Miles Bridges performing in the live Charlotte Hornets vs Los Angeles Lakers game?'

// Final game
const query = getContextualQuery(finalGame);
// 'Cade Cunningham scored 46 points - what are fans saying?'

// Upcoming game
const query = getContextualQuery(upcomingGame);
// 'What are the predictions for Charlotte Hornets vs Los Angeles Lakers?'
```

---

### `shuffleQueries(queries: string[]): string[]`

Shuffles query order for variety.

**Parameters:**
- `queries` - Array of query strings

**Returns:**
- Shuffled array

**Example:**
```typescript
const queries = generateSampleQueries(games);
const shuffled = shuffleQueries(queries);
// Returns queries in random order
```

---

## Query Templates

### Stats Queries
```
"What are {player}'s stats since the beginning of the season?"
"How is {player} performing this year?"
"What are {player}'s season stats?"
"Show me {player}'s performance breakdown"
"How many points per game is {player} averaging?"
```

### Sentiment Queries
```
"Are fans excited by what {player} demonstrated so far?"
"What are fans saying about {team}?"
"What do people think about {player}'s performance?"
"Are fans excited about {team}?"
```

### Comparison Queries
```
"Compare {player1} and {player2}'s performance this season"
"Compare {player1} and {player2}"
"{player1} vs {player2} - who's better?"
"Which team is stronger: {team1} or {team2}?"
```

### Matchup Queries
```
"What are fans saying about {team1} vs {team2}?"
"What are the predictions for {team1} vs {team2}?"
```

### Live Game Queries
```
"How is {player} performing in tonight's game?"
"How is {player} performing in the live {team1} vs {team2} game?"
```

### Hot Takes
```
"What are the hottest takes about {player} right now?"
"{player} scored {points} points - what are fans saying?"
```

---

## Test Results

### ✅ All Success Criteria Met

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Returns 4-6 queries | ✅ | Generated 5-6 queries |
| Uses real player names | ✅ | Cade Cunningham, Luka Dončić, etc. |
| Falls back to defaults | ✅ | LeBron, Curry when no games |
| Queries are varied | ✅ | Stats, sentiment, comparison mixed |
| Prioritizes live games | ✅ | Live game players boosted |
| Handles edge cases | ✅ | Empty array, null, no players |

### Test Output

```bash
🏀 TESTING WITH REAL LIVE GAME DATA

✅ Found 9 games

🎯 Generated Sample Queries:

1. What are Cade Cunningham's stats since the beginning of the season?
   Are fans excited by what he demonstrated so far?
2. What are fans saying about Charlotte Hornets vs Los Angeles Lakers?
3. Compare Cade Cunningham and CJ McCollum's performance this season
4. How are the Pistons doing this season? What do fans think?
5. What are the hottest takes about Grayson Allen right now?

✅ Successfully generated 5 contextual queries!

📋 Success Criteria:
   ✅ Returns 4-6 queries: true
   ✅ Uses real player names: true
   ✅ Varied query types:
      - Stats: true
      - Sentiment: true
      - Comparison/Matchup: true
```

---

## Integration Example

### In React Component

```tsx
'use client';

import { useEffect, useState } from 'react';
import { generateSampleQueries, LiveGame } from '@/lib/query-generator';

export default function SampleQueries() {
  const [queries, setQueries] = useState<string[]>([]);

  useEffect(() => {
    async function loadQueries() {
      try {
        // Fetch live games
        const res = await fetch('/api/live-games');
        const data = await res.json();

        // Generate contextual queries
        const generated = generateSampleQueries(data.games);
        setQueries(generated);
      } catch (error) {
        console.error('Failed to generate queries:', error);
        // Use empty array to trigger fallback
        setQueries(generateSampleQueries([]));
      }
    }

    loadQueries();

    // Refresh every 5 minutes
    const interval = setInterval(loadQueries, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      <h3 className="font-bold">Try asking:</h3>
      {queries.map((query, i) => (
        <button
          key={i}
          onClick={() => handleQueryClick(query)}
          className="block w-full text-left p-2 hover:bg-blue-500/20"
        >
          {query}
        </button>
      ))}
    </div>
  );
}
```

---

## Player Priority Logic

### Scoring System

1. **Live Game Boost:** +100 points
2. **Base Score:** Player's actual points in game
3. **Sort:** Descending by adjusted score
4. **Deduplicate:** Remove duplicate player names
5. **Return:** Top 6 players

### Example

```typescript
// Game 1 (Live): Luka Dončić - 38 pts
//   Adjusted: 138 pts (38 + 100 live boost)

// Game 2 (Final): Cade Cunningham - 46 pts
//   Adjusted: 46 pts

// Result: Luka prioritized despite lower actual score
```

---

## Default Players

When no games are available, uses popular NBA players:
- LeBron James
- Stephen Curry
- Giannis Antetokounmpo
- Nikola Jokić
- Kevin Durant

And popular teams:
- Lakers
- Celtics
- Warriors
- Bucks

---

## Edge Cases Handled

### ✅ Empty Game Array
```typescript
generateSampleQueries([]);
// Returns: Default queries with popular players
```

### ✅ Null/Undefined Input
```typescript
generateSampleQueries(null);
// Returns: Default queries (safe fallback)
```

### ✅ Game with No Players
```typescript
const gameNoPlayers = { topPlayers: [], ... };
generateSampleQueries([gameNoPlayers]);
// Returns: Team-based queries + defaults
```

### ✅ All Games Final (No Live)
```typescript
// Still generates relevant queries for recent games
// Just doesn't include "tonight's game" language
```

---

## Testing

### Run Test Suite
```bash
npx tsx lib/test-query-generator.ts
```

### Test with Live Data
```bash
npx tsx lib/test-with-live-data.ts
```

### Test in Node Console
```typescript
import { generateSampleQueries } from './lib/query-generator';

const mockGames = [/* ... */];
const queries = generateSampleQueries(mockGames);
console.log(queries);
```

---

## File Locations

- **Main Utility:** `/lib/query-generator.ts`
- **Test Suite:** `/lib/test-query-generator.ts`
- **Live Data Test:** `/lib/test-with-live-data.ts`
- **Documentation:** `/QUERY_GENERATOR.md` (this file)

---

## Future Enhancements

### 1. **Caching**
```typescript
// Cache queries for 5 minutes
const cachedQueries = useMemo(
  () => generateSampleQueries(games),
  [games]
);
```

### 2. **Personalization**
```typescript
// Based on user's favorite team/players
generateSampleQueries(games, {
  favoriteTeam: 'Lakers',
  favoritePlayers: ['LeBron James']
});
```

### 3. **Trending Topics**
```typescript
// Include trending hashtags/topics
generateSampleQueries(games, {
  trendingTopics: ['#NBAPlayoffs', 'MVP race']
});
```

### 4. **Historical Context**
```typescript
// Add streak/milestone queries
"LeBron James is 2 points away from 40,000 career points!"
```

---

## Summary

✅ **Production-ready** query generator that:
- Generates 4-6 contextual queries dynamically
- Uses real player names from live games
- Falls back gracefully to popular players
- Mixes stats, sentiment, and comparison queries
- Handles all edge cases safely
- Tested with mock and real data
- Ready for React component integration

**Ready for Phase 5: Integrate into Stats and Buzz chat UI!** 🏀
