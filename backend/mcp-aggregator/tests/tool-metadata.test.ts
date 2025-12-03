import assert from 'node:assert/strict';

import { summarizeToolMetadata } from '../src/tool-metadata.js';

const tool = {
  name: 'compare_two_players_career',
  description: 'Side-by-side comparison of NBA players across their careers including PPG, APG, RPG.',
  inputSchema: {
    type: 'object',
    properties: {
      player1_id: { type: 'string' },
      player2_id: { type: 'string' },
      season_id: { type: 'string' }
    },
    required: ['player1_id', 'player2_id', 'season_id']
  }
};

const summary = summarizeToolMetadata(tool as any);

assert(summary.derivedTags.includes('player_comparison'), 'Expected player_comparison tag');
assert.equal(summary.labels.length, 0);
assert.equal(summary.categories.length, 0);

const sentimentTool = {
  name: 'get_combined_player_sentiment',
  description: 'Aggregates social sentiment from Twitter, Reddit, and narrative sources for NBA topics.'
};

const sentimentSummary = summarizeToolMetadata(sentimentTool as any);
assert(
  sentimentSummary.derivedTags.includes('sentiment_analysis'),
  'Expected sentiment_analysis tag for sentiment tool'
);

console.log('✅ Tool metadata summarizer tests passed');
