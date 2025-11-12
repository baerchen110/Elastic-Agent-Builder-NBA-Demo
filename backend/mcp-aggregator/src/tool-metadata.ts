import { MCPTool } from './types.js';

export interface ToolMetadataSummary {
  labels: string[];
  categories: string[];
  derivedTags: string[];
  synopsis?: string;
}

const KEYWORD_RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  {
    tag: 'player_stats',
    patterns: [/player\s*(career|season)?\s*stats?/i, /ppg|apg|rpg/i, /performance/i]
  },
  {
    tag: 'player_comparison',
    patterns: [/compare/i, /side-by-side/i]
  },
  {
    tag: 'live_games',
    patterns: [/live/i, /current/i, /upcoming/i, /scoreboard/i]
  },
  {
    tag: 'semantic_search',
    patterns: [/search/i, /semantic/i, /full-?text/i]
  },
  {
    tag: 'esql',
    patterns: [/es\|ql/i, /query/i]
  },
  {
    tag: 'team_stats',
    patterns: [/team/i, /standings/i]
  },
  {
    tag: 'games_lookup',
    patterns: [/game/i, /schedule/i]
  },
  {
    tag: 'sentiment_analysis',
    patterns: [/sentiment/i, /twitter/i, /reddit/i, /social/i, /narrative/i, /buzz/i]
  },
  {
    tag: 'aggregation',
    patterns: [/aggregate/i, /summary/i, /rollup/i]
  }
];

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.trim())
    )
  );
}

export function summarizeToolMetadata(tool: MCPTool): ToolMetadataSummary {
  const metadataLike = tool.metadata ?? (tool as any).metadata ?? {};
  const directLabels = (tool as any).labels as string[] | undefined;
  const directCategories = (tool as any).categories as string[] | undefined;

  const labels = uniqueStrings([
    ...(metadataLike.labels ?? []),
    ...(directLabels ?? [])
  ]);

  const categories = uniqueStrings([
    ...(metadataLike.categories ?? []),
    ...(directCategories ?? [])
  ]);

  const searchableText = [
    tool.name,
    tool.description,
    ...(metadataLike.summary ? [metadataLike.summary] : []),
    ...(metadataLike.synopsis ? [metadataLike.synopsis] : []),
    ...(metadataLike.keywords ?? [])
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  const derivedTags = KEYWORD_RULES
    .filter(rule => rule.patterns.some(pattern => pattern.test(searchableText)))
    .map(rule => rule.tag);

  return {
    labels,
    categories,
    derivedTags,
    synopsis: metadataLike.synopsis || metadataLike.summary
  };
}
