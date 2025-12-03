import { describe, expect, it, vi } from 'vitest';
import { TwitterSentimentService } from '../services/twitter-service.js';
import { RedditSentimentService } from '../services/reddit-service.js';
import { NarrativeSentimentService } from '../services/narrative-service.js';
import { SentimentAggregationService } from '../services/aggregation-service.js';
import { SentimentConfig, SentimentSummary } from '../types.js';

const baseConfig: SentimentConfig = {
  defaultWindowMinutes: 180,
  maxSamples: 20
};

describe('TwitterSentimentService', () => {
  it('falls back gracefully without credentials', async () => {
    const service = new TwitterSentimentService(baseConfig);
    const summary = await service.getSentiment({ subject: 'LeBron James' });
    expect(summary.tags).toContain('degraded');
    expect(summary.notes).toContain('Twitter credentials missing');
    expect(summary.sampleSize).toBeGreaterThan(0);
  });

  it('uses API when credentials and http client are provided', async () => {
    const http = {
      get: vi.fn().mockResolvedValue({
        data: {
          data: [
            {
              id: '1',
              text: 'Huge clutch performance tonight!',
              lang: 'en'
            }
          ]
        }
      })
    } as any;

    const service = new TwitterSentimentService(
      { ...baseConfig, twitterBearerToken: 'token' },
      undefined,
      http
    );

    const summary = await service.getSentiment({ subject: 'Lakers' });
    expect(summary.tags).not.toContain('degraded');
    expect(summary.sampleSize).toBe(1);
    expect(summary.notes).toContain('Twitter sample size: 1');
    expect(http.get).toHaveBeenCalledOnce();
  });
});

describe('RedditSentimentService', () => {
  it('falls back gracefully without credentials', async () => {
    const service = new RedditSentimentService(baseConfig);
    const summary = await service.getSentiment({ subject: 'Boston Celtics' });
    expect(summary.tags).toContain('degraded');
    expect(summary.notes).toContain('Reddit credentials missing');
  });
});

describe('NarrativeSentimentService', () => {
  it('produces storyline notes', async () => {
    const service = new NarrativeSentimentService(baseConfig);
    const summary = await service.getNarrativeInsights({ subject: 'MVP race' });
    expect(summary.notes).toMatch(/MVP race/);
    expect(summary.tags).toContain('storyline');
  });
});

describe('SentimentAggregationService', () => {
  it('weights sources and surfaces degraded signals', () => {
    const aggregation = new SentimentAggregationService();
    const sources: SentimentSummary[] = [
      {
        source: 'twitter',
        subject: 'Test',
        averageScore: 0.6,
        confidence: 0.7,
        sampleSize: 10,
        samples: [],
        tags: ['positive'],
        generatedAt: new Date().toISOString()
      },
      {
        source: 'reddit',
        subject: 'Test',
        averageScore: -0.2,
        confidence: 0.4,
        sampleSize: 5,
        samples: [],
        tags: ['degraded'],
        generatedAt: new Date().toISOString(),
        notes: 'fallback'
      }
    ];

    const result = aggregation.aggregate('Test', sources);
    expect(result.tags).toContain('aggregated');
    expect(result.tags).toContain('degraded');
    expect(result.breakdown).toHaveLength(2);
    expect(result.notes).toMatch(/Degraded sources: reddit/);
  });
});
