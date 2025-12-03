#!/usr/bin/env node

/**
 * Sentiment MCP Server
 * Provides social sentiment, narrative, and aggregated insights for NBA topics.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { sentimentConfig, validateConfig } from './config.js';
import { SentimentAggregationService } from './services/aggregation-service.js';
import { TwitterSentimentService } from './services/twitter-service.js';
import { RedditSentimentService } from './services/reddit-service.js';
import { NarrativeSentimentService } from './services/narrative-service.js';
import { SentimentRequest, SentimentSummary } from './types.js';

console.error('[Sentiment MCP] Twitter service enabled:', sentimentConfig.twitterServiceEnabled);
console.error('[Sentiment MCP] Reddit credentials present:', !!(sentimentConfig.redditClientId && sentimentConfig.redditClientSecret));

validateConfig(sentimentConfig);

const aggregationService = new SentimentAggregationService();
const twitterService = new TwitterSentimentService(sentimentConfig);
const redditService = new RedditSentimentService(sentimentConfig);
const narrativeService = new NarrativeSentimentService(sentimentConfig);

const tools: Tool[] = [
//   {
//     name: 'get_twitter_player_sentiment',
//     description: 'Analyze near real-time Twitter/X sentiment for a specific NBA player, team, or storyline.',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         player_name: {
//           type: 'string',
//           description: 'Primary subject to analyze (player, team, or topic).'
//         },
//         timeframe: {
//           type: 'string',
//           enum: ['24h', '7d', '30d', 'all'],
//           description: 'Lookback range to analyze. Defaults to configured window.'
//         },
//         limit: {
//           type: 'integer',
//           description: 'Maximum tweets to sample (default matches server config).'
//         }
//       },
//       required: ['player_name']
//     }
//   },
  {
    name: 'get_reddit_player_sentiment',
    description: 'Analyze Reddit community sentiment about an NBA player, team, or storyline.',
    inputSchema: {
      type: 'object',
      properties: {
        player_name: {
          type: 'string',
          description: 'Subject to analyze (player, team, or topic).'
        },
        subreddits: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of subreddits to focus on (defaults to cross-subreddit search).'
        },
        timeframe: {
          type: 'string',
          enum: ['24h', '7d', '30d', 'all'],
          description: 'Lookback window across Reddit discussions.'
        },
        limit: {
          type: 'integer',
          description: 'Maximum posts/comments to sample (default matches server config).'
        }
      },
      required: ['player_name']
    }
  },
  {
    name: 'get_combined_player_sentiment',
    description: 'Blend Twitter and Reddit sentiment signals with weighting and breakdown details.',
    inputSchema: {
      type: 'object',
      properties: {
        player_name: {
          type: 'string',
          description: 'Subject to analyze (player, team, or topic).'
        },
        timeframe: {
          type: 'string',
          enum: ['24h', '7d', '30d', 'all'],
          description: 'Lookback window used for each data source.'
        },
        limit: {
          type: 'integer',
          description: 'Maximum samples per source.'
        },
        sources: {
          type: 'array',
          items: { type: 'string', enum: ['twitter', 'reddit', 'narrative'] },
          description: 'Override the combination of sources (defaults to twitter+reddit).'
        }
      },
      required: ['player_name']
    }
  },
  {
    name: 'analyze_player_narrative_trend',
    description: 'Track how sentiment momentum and narratives evolve across multiple timeframes.',
    inputSchema: {
      type: 'object',
      properties: {
        player_name: {
          type: 'string',
          description: 'Subject to track over time.'
        },
        compare_periods: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of timeframe labels (e.g., 30d, 7d, 24h, today).'
        }
      },
      required: ['player_name']
    }
  },
  {
    name: 'detect_narrative_shift',
    description: 'Identify sharp positive or negative sentiment swings versus the recent baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        player_name: {
          type: 'string',
          description: 'Subject to analyze for momentum swings.'
        },
        sensitivity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Threshold strictness for detecting a shift (default: medium).'
        }
      },
      required: ['player_name']
    }
  },
  {
    name: 'compare_players_sentiment',
    description: 'Compare sentiment scores, momentum, and volume between two players or teams.',
    inputSchema: {
      type: 'object',
      properties: {
        player1_name: {
          type: 'string',
          description: 'First player to compare.'
        },
        player2_name: {
          type: 'string',
          description: 'Second player to compare.'
        },
        timeframe: {
          type: 'string',
          enum: ['24h', '7d', '30d', 'all'],
          description: 'Shared lookback window for comparison.'
        }
      },
      required: ['player1_name', 'player2_name']
    }
  }
];

const server = new Server(
  {
    name: 'sentiment-mcp-server',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request: {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_twitter_player_sentiment':
        return wrapSummary(await twitterService.getSentiment(buildSentimentRequest(args)));
      case 'get_reddit_player_sentiment':
        return wrapSummary(await redditService.getSentiment(buildSentimentRequest(args, {
          overrides: {
            filters: extractRedditFilters(args)
          }
        })));
      case 'get_combined_player_sentiment': {
        const combined = await buildCombinedSentiment(args);
        return wrapJson(combined);
      }
      case 'analyze_player_narrative_trend': {
        const trend = await analyzeNarrativeTrend(args);
        return wrapJson(trend);
      }
      case 'detect_narrative_shift': {
        const shift = await detectNarrativeShift(args);
        return wrapJson(shift);
      }
      case 'compare_players_sentiment': {
        const comparison = await comparePlayersSentiment(args);
        return wrapJson(comparison);
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return wrapJson({
      error: error?.message || 'Sentiment tool call failed',
      tool: name
    }, true);
  }
});

function wrapSummary(summary: SentimentSummary) {
  return wrapJson(summary);
}

function wrapJson(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ],
    ...(isError ? { isError: true } : {})
  };
}

function buildSentimentRequest(
  args: Record<string, unknown> | undefined,
  options: { overrides?: Partial<SentimentRequest> } = {}
): SentimentRequest {
  const subject = extractPlayerName(args);
  const window = resolveWindowMinutes(args);
  const maxSamples = resolveMaxSamples(args);

  const base: SentimentRequest = {
    subject,
    windowMinutes: window,
    maxSamples
  };

  if (options.overrides?.filters) {
    base.filters = options.overrides.filters;
  } else if (typeof args?.filters === 'object' && args.filters !== null) {
    base.filters = args.filters as Record<string, unknown>;
  }

  return base;
}

function extractPlayerName(args: Record<string, unknown> | undefined): string {
  const subject = args?.player_name || args?.subject;
  if (typeof subject !== 'string' || !subject.trim()) {
    throw new Error('player_name (or subject) is required and must be a string');
  }
  return subject.trim();
}

function resolveMaxSamples(args: Record<string, unknown> | undefined): number | undefined {
  const candidate = args?.limit ?? args?.max_samples;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.floor(candidate);
  }
  return undefined;
}

function resolveWindowMinutes(args: Record<string, unknown> | undefined): number {
  const directWindow = args?.window_minutes;
  if (typeof directWindow === 'number' && directWindow > 0) {
    return directWindow;
  }

  const timeframe = typeof args?.timeframe === 'string'
    ? args.timeframe
    : typeof args?.window === 'string'
      ? args.window
      : undefined;

  return mapTimeframeToMinutes(timeframe, sentimentConfig.defaultWindowMinutes);
}

function mapTimeframeToMinutes(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  const mapped = TIMEFRAME_ALIASES[normalized] ?? normalized;

  if (mapped in TIMEFRAME_MINUTES) {
    return TIMEFRAME_MINUTES[mapped as keyof typeof TIMEFRAME_MINUTES];
  }

  const durationMatch = mapped.match(/^(\d+)\s*(m|min|mins|minute|minutes)$/);
  if (durationMatch) {
    return Number(durationMatch[1]);
  }

  const hourMatch = mapped.match(/^(\d+)\s*(h|hr|hour|hours)$/);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  const dayMatch = mapped.match(/^(\d+)\s*(d|day|days)$/);
  if (dayMatch) {
    return Number(dayMatch[1]) * 1_440;
  }

  return fallback;
}

const TIMEFRAME_MINUTES = {
  '24h': 1_440,
  '1d': 1_440,
  'today': 1_440,
  '7d': 10_080,
  'week': 10_080,
  '7d_ago': 10_080,
  '30d': 43_200,
  '30d_ago': 43_200,
  'month': 43_200,
  'all': sentimentConfig.defaultWindowMinutes
} as const;

const TIMEFRAME_ALIASES: Record<string, string> = {
  'yesterday': '24h',
  'past_day': '24h',
  'past_week': '7d',
  'past_month': '30d'
};

function extractRedditFilters(args: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!args?.subreddits) {
    return undefined;
  }
  const subreddits = Array.isArray(args.subreddits)
    ? args.subreddits.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  if (!subreddits.length) {
    return undefined;
  }

  return { subreddits };
}

async function buildCombinedSentiment(args: Record<string, unknown> | undefined) {
  const subject = extractPlayerName(args);
  const timeframeLabel = typeof args?.timeframe === 'string' ? args.timeframe : undefined;
  const windowMinutes = resolveWindowMinutes(args);
  const maxSamples = resolveMaxSamples(args);
  const sources = extractSources(args?.sources);

  console.error('[Sentiment MCP] buildCombinedSentiment called with sources:', sources);

  const summaries: Record<string, SentimentSummary> = {};
  const selectedSummaries: SentimentSummary[] = [];

  if (sources.includes('twitter') && sentimentConfig.twitterServiceEnabled) {
    console.error('[Sentiment MCP] Calling Twitter service');
    const summary = await twitterService.getSentiment({ subject, windowMinutes, maxSamples });
    summaries.twitter = summary;
    selectedSummaries.push(summary);
  }

  if (sources.includes('reddit')) {
    console.error('[Sentiment MCP] Calling Reddit service');
    const summary = await redditService.getSentiment({
      subject,
      windowMinutes,
      maxSamples,
      filters: extractRedditFilters(args)
    });
    summaries.reddit = summary;
    selectedSummaries.push(summary);
  }

  if (sources.includes('narrative')) {
    const summary = await narrativeService.getNarrativeInsights({
      subject,
      windowMinutes,
      maxSamples
    });
    summaries.narrative = summary;
    selectedSummaries.push(summary);
  }

  if (!selectedSummaries.length) {
    throw new Error('At least one sentiment source must be selected.');
  }

  const aggregate = aggregationService.aggregate(subject, selectedSummaries);

  return {
    subject,
    timeframe: timeframeLabel ?? 'default',
    windowMinutes,
    aggregate,
    sources: summaries
  };
}

function extractSources(raw: unknown): string[] {
  const defaultSources = sentimentConfig.twitterServiceEnabled
    ? ['twitter', 'reddit']
    : ['reddit'];

  if (!raw) {
    return defaultSources;
  }

  if (Array.isArray(raw)) {
    const normalized = raw
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.toLowerCase())
      .filter(value => ['twitter', 'reddit', 'narrative'].includes(value));

    return normalized.length ? normalized : defaultSources;
  }

  if (typeof raw === 'string') {
    return extractSources([raw]);
  }

  return defaultSources;
}

async function analyzeNarrativeTrend(args: Record<string, unknown> | undefined) {
  const subject = extractPlayerName(args);
  const periods = extractComparePeriods(args?.compare_periods);

  const timeline = [] as Array<{
    period: string;
    combined: Awaited<ReturnType<typeof buildCombinedSentiment>>;
  }>;

  for (const period of periods) {
    const combined = await buildCombinedSentiment({
      player_name: subject,
      timeframe: period
    });
    timeline.push({ period, combined });
  }

  const first = timeline[0]?.combined.aggregate.averageScore ?? 0;
  const last = timeline[timeline.length - 1]?.combined.aggregate.averageScore ?? 0;
  const shift = Number((last - first).toFixed(3));

  return {
    player_name: subject,
    periods: timeline.map(entry => ({
      label: entry.period,
      windowMinutes: entry.combined.windowMinutes,
      aggregate: entry.combined.aggregate
    })),
    trajectory: computeTrajectoryLabel(shift),
    sentiment_shift: shift,
    sentiment_momentum: shift > 0 ? 'Positive Momentum' : shift < 0 ? 'Negative Momentum' : 'Neutral Momentum'
  };
}

function extractComparePeriods(raw: unknown): string[] {
  if (!raw) {
    return ['30d', '7d', '24h'];
  }

  if (Array.isArray(raw)) {
    const options = raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return options.length ? options : ['30d', '7d', '24h'];
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return [raw.trim()];
  }

  return ['30d', '7d', '24h'];
}

function computeTrajectoryLabel(shift: number): string {
  if (shift > 0.05) return '📈 IMPROVING';
  if (shift < -0.05) return '📉 DECLINING';
  return '➡️ STABLE';
}

async function detectNarrativeShift(args: Record<string, unknown> | undefined) {
  const subject = extractPlayerName(args);
  const sensitivity = typeof args?.sensitivity === 'string' ? args.sensitivity.toLowerCase() : 'medium';
  const thresholds: Record<string, number> = {
    low: 0.15,
    medium: 0.1,
    high: 0.05
  };

  const threshold = thresholds[sensitivity] ?? thresholds.medium;

  const recent = await buildCombinedSentiment({ player_name: subject, timeframe: '24h' });
  const baseline = await buildCombinedSentiment({ player_name: subject, timeframe: '7d' });

  const shift = Number((recent.aggregate.averageScore - baseline.aggregate.averageScore).toFixed(3));
  const isShift = Math.abs(shift) > threshold;

  return {
    player_name: subject,
    shift_detected: isShift,
    shift_magnitude: shift,
    direction: shift > 0 ? 'Positive' : shift < 0 ? 'Negative' : 'Neutral',
    sensitivity,
    threshold,
    recent: {
      timeframe: '24h',
      aggregate: recent.aggregate
    },
    baseline: {
      timeframe: '7d',
      aggregate: baseline.aggregate
    },
    interpretation: isShift
      ? `${shift > 0 ? '🔥 Positive' : '📉 Negative'} narrative shift detected in the last 24h compared to 7d baseline.`
      : 'Narrative remains stable against the recent baseline.'
  };
}

async function comparePlayersSentiment(args: Record<string, unknown> | undefined) {
  const player1 = typeof args?.player1_name === 'string' ? args.player1_name.trim() : '';
  const player2 = typeof args?.player2_name === 'string' ? args.player2_name.trim() : '';

  if (!player1 || !player2) {
    throw new Error('player1_name and player2_name are required');
  }

  const timeframe = typeof args?.timeframe === 'string' ? args.timeframe : undefined;

  const requestArgs = timeframe ? { timeframe } : {};

  const [first, second] = await Promise.all([
    buildCombinedSentiment({ player_name: player1, ...requestArgs }),
    buildCombinedSentiment({ player_name: player2, ...requestArgs })
  ]);

  const diff = Number((first.aggregate.averageScore - second.aggregate.averageScore).toFixed(3));

  return {
    timeframe: timeframe ?? 'default',
    comparison: {
      leader: diff > 0 ? player1 : diff < 0 ? player2 : 'Even',
      difference: diff,
      interpretation: interpretComparison(diff, player1, player2)
    },
    players: [
      {
        name: player1,
        aggregate: first.aggregate
      },
      {
        name: player2,
        aggregate: second.aggregate
      }
    ]
  };
}

function interpretComparison(diff: number, player1: string, player2: string): string {
  if (diff > 0.1) {
    return `${player1} shows a markedly more positive sentiment profile right now.`;
  }
  if (diff < -0.1) {
    return `${player2} shows a markedly more positive sentiment profile right now.`;
  }
  if (diff > 0.02) {
    return `${player1} holds a slight sentiment edge over ${player2}.`;
  }
  if (diff < -0.02) {
    return `${player2} holds a slight sentiment edge over ${player1}.`;
  }
  return 'Sentiment is effectively balanced between both players.';
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Sentiment MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Sentiment MCP Server failed to start:', error);
  const nodeProcess = (globalThis as any)?.process;
  if (typeof nodeProcess?.exit === 'function') {
    nodeProcess.exit(1);
  }
});
