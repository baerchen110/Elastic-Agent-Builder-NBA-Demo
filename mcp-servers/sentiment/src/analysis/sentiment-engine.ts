import { NEGATIVE_TERMS, POSITIVE_TERMS } from './lexicon.js';
import { SentimentSample, SentimentSummary } from '../types.js';

export interface SentimentEngineOptions {
  subject: string;
  source: SentimentSummary['source'];
  windowMinutes: number;
  maxSamples: number;
}

const positiveSet = new Set(POSITIVE_TERMS);
const negativeSet = new Set(NEGATIVE_TERMS);

export class SentimentEngine {
  analyze(texts: string[], options: SentimentEngineOptions): SentimentSummary {
    const samples = texts
      .filter(Boolean)
      .slice(0, options.maxSamples)
      .map((text, index) => this.buildSample(text, options, index));

    const sampleSize = samples.length;

    const averageScore = sampleSize
      ? samples.reduce((acc, sample) => acc + sample.score, 0) / sampleSize
      : 0;

    const averageConfidence = sampleSize
      ? samples.reduce((acc, sample) => acc + sample.confidence, 0) / sampleSize
      : 0;

    return {
      source: options.source,
      subject: options.subject,
      averageScore: Number(averageScore.toFixed(3)),
      confidence: Number(averageConfidence.toFixed(3)),
      samples,
      sampleSize,
      tags: this.buildTags(averageScore, averageConfidence),
      generatedAt: new Date().toISOString()
    };
  }

  private buildTags(score: number, confidence: number): string[] {
    const tags = ['sentiment'];
    if (score > 0.25) tags.push('positive');
    else if (score < -0.25) tags.push('negative');
    else tags.push('neutral');

    if (confidence >= 0.6) tags.push('high-confidence');
    else if (confidence < 0.3) tags.push('low-confidence');

    return tags;
  }

  private buildSample(text: string, options: SentimentEngineOptions, index: number): SentimentSample {
    const normalized = text.toLowerCase();
    const tokens = normalized.split(/[^a-z0-9-]+/).filter(Boolean);

    let score = 0;
    let hits = 0;

    for (const token of tokens) {
      if (positiveSet.has(token)) {
        score += 1;
        hits += 1;
      } else if (negativeSet.has(token)) {
        score -= 1;
        hits += 1;
      }
    }

    const normalizedScore = tokens.length ? score / Math.sqrt(tokens.length) : 0;
    const confidence = hits ? Math.min(1, hits / Math.max(tokens.length, 6)) : 0.1;

    return {
      id: `${options.source}-${index}`,
      text,
      score: Number(Math.max(-1, Math.min(1, normalizedScore)).toFixed(3)),
      confidence: Number(confidence.toFixed(3))
    };
  }
}
