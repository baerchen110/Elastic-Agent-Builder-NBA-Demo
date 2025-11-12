import { AggregatedSentimentSummary, SentimentSummary } from '../types.js';

export class SentimentAggregationService {
  aggregate(subject: string, sources: SentimentSummary[]): AggregatedSentimentSummary {
    const breakdown = sources.map(source => ({
      source: source.source === 'aggregate' ? 'narrative' : source.source,
      averageScore: source.averageScore,
      confidence: source.confidence,
      sampleSize: source.sampleSize
    }));

    const weights = sources
      .filter(s => s.sampleSize > 0)
      .map(s => ({ weight: s.sampleSize, score: s.averageScore }));

    const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0);
    const weightedScore = totalWeight > 0
      ? weights.reduce((acc, w) => acc + w.score * w.weight, 0) / totalWeight
      : sources.reduce((acc, w) => acc + w.averageScore, 0) / (sources.length || 1);

    const averageConfidence = sources.length
      ? sources.reduce((acc, s) => acc + s.confidence, 0) / sources.length
      : 0;

    const totalSamples = sources.reduce((acc, s) => acc + s.sampleSize, 0);
    const highlightSource = this.pickHighlightSource(sources);
    const degradedSources = sources.filter(s => s.tags.includes('degraded')).map(s => s.source);

    const tags = new Set<string>(['aggregated']);
    if (weightedScore > 0.25) tags.add('positive');
    else if (weightedScore < -0.25) tags.add('negative');
    else tags.add('neutral');

    if (averageConfidence >= 0.6) tags.add('high-confidence');
    else if (averageConfidence < 0.3) tags.add('low-confidence');

    if (degradedSources.length) tags.add('degraded');

    const noteParts: string[] = [];
    noteParts.push(`Weighted by ${totalSamples} samples across ${sources.length} sources.`);
    if (highlightSource) {
      noteParts.push(`Largest contribution from ${highlightSource.source} (${highlightSource.sampleSize} samples, score ${highlightSource.averageScore}).`);
    }
    if (degradedSources.length) {
      noteParts.push(`Degraded sources: ${degradedSources.join(', ')}.`);
    }

    return {
      source: 'aggregate',
      subject,
      averageScore: Number(weightedScore.toFixed(3)),
      confidence: Number(averageConfidence.toFixed(3)),
      sampleSize: totalSamples,
      samples: sources.flatMap(s => s.samples).slice(0, 10),
      tags: Array.from(tags),
      generatedAt: new Date().toISOString(),
      notes: noteParts.join(' '),
      breakdown
    };
  }

  private pickHighlightSource(sources: SentimentSummary[]): SentimentSummary | null {
    if (!sources.length) {
      return null;
    }
    return sources.reduce((top, current) => {
      if (!top) return current;
      if (current.sampleSize > top.sampleSize) return current;
      if (current.sampleSize === top.sampleSize && current.confidence > top.confidence) return current;
      return top;
    }, sources[0]);
  }
}
