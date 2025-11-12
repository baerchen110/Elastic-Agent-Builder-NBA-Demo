/// <reference types="vitest" />
import { describe, expect, it } from 'vitest';
import { SentimentEngine } from '../analysis/sentiment-engine.js';
import { buildFallbackSamples } from '../utils/fallback.js';

const engine = new SentimentEngine();

describe('SentimentEngine', () => {
  it('produces positive score for upbeat texts', () => {
    const summary = engine.analyze([
      'Victor Wembanyama delivered a dominant performance with unreal touch tonight.',
      'Fans love how clutch he has been lately'
    ], {
      subject: 'Victor Wembanyama',
      source: 'twitter',
      windowMinutes: 60,
      maxSamples: 10
    });

    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.tags).toContain('positive');
    expect(summary.tags).toContain('sentiment');
  });

  it('produces negative score for critical texts', () => {
    const summary = engine.analyze([
      'Turnovers keep piling up and the defense looks awful',
      'The offense is in a brutal slump and feels trash right now'
    ], {
      subject: 'Team performance',
      source: 'reddit',
      windowMinutes: 120,
      maxSamples: 10
    });

    expect(summary.averageScore).toBeLessThan(0);
    expect(summary.tags).toContain('negative');
  });
});

describe('Fallback helpers', () => {
  it('generates deterministic sample count', () => {
    const request = { subject: 'Los Angeles Lakers' } as any;
    const samples = buildFallbackSamples(request, 'twitter', 8);
    expect(samples).toHaveLength(8);
    const secondCall = buildFallbackSamples(request, 'twitter', 8);
    expect(secondCall).toStrictEqual(samples);
  });
});
