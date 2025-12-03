import { SentimentEngine } from '../analysis/sentiment-engine.js';
import { buildFallbackSamples } from '../utils/fallback.js';
import { SentimentConfig, SentimentRequest, SentimentSummary } from '../types.js';

export class NarrativeSentimentService {
  private readonly config: SentimentConfig;
  private readonly engine: SentimentEngine;

  constructor(config: SentimentConfig, engine: SentimentEngine = new SentimentEngine()) {
    this.config = config;
    this.engine = engine;
  }

  async getNarrativeInsights(request: SentimentRequest): Promise<SentimentSummary> {
    const windowMinutes = request.windowMinutes ?? this.config.defaultWindowMinutes;
    const maxSamples = request.maxSamples ?? Math.min(this.config.maxSamples, 20);

    const fallbackTexts = buildFallbackSamples(request, 'narrative', maxSamples);
    const summary = this.engine.analyze(fallbackTexts, {
      source: 'narrative',
      subject: request.subject,
      windowMinutes,
      maxSamples
    });

    summary.tags.push('storyline');
    summary.notes = this.composeNarrative(summary);

    return summary;
  }

  private composeNarrative(summary: SentimentSummary): string {
    const polarity = summary.averageScore > 0.25
      ? 'Positive sentiment is trending'
      : summary.averageScore < -0.25
        ? 'Negative chatter dominates'
        : 'Fans are split with mixed reactions';

    const confidenceDescriptor = summary.confidence > 0.6
      ? 'high confidence'
      : summary.confidence < 0.3
        ? 'low confidence'
        : 'moderate confidence';

    return `${polarity} around ${summary.subject} with ${confidenceDescriptor} based on ${summary.sampleSize} synthesized highlights.`;
  }
}
