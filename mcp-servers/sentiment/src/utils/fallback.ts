import { SentimentRequest } from '../types.js';

const POSITIVE_SNIPPETS = [
  'is carrying the team tonight',
  'just dropped a massive double-double',
  'keeps making winning plays',
  'looks locked in on both ends',
  'is on an unreal hot streak',
  'makes everyone around better',
  'deserves serious MVP buzz'
];

const NEGATIVE_SNIPPETS = [
  'needs to get out of this shooting slump',
  'looks a step slow on defense',
  'keeps turning the ball over',
  'has been dealing with nagging injuries',
  'is getting torched on switches',
  'has questionable shot selection lately'
];

function seededRandom(seed: string): () => number {
  let x = 0;
  for (let i = 0; i < seed.length; i += 1) {
    x = (x << 5) - x + seed.charCodeAt(i);
    x |= 0; // Convert to 32bit integer
  }

  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return (x < 0 ? ~x + 1 : x) / 4294967296;
  };
}

export function buildFallbackSamples(request: SentimentRequest, sourceLabel: string, totalSamples = 12): string[] {
  const rand = seededRandom(`${sourceLabel}-${request.subject}`);
  const samples: string[] = [];

  for (let i = 0; i < totalSamples; i += 1) {
    const positive = rand() > 0.45;
    const baseText = positive
      ? POSITIVE_SNIPPETS[Math.floor(rand() * POSITIVE_SNIPPETS.length)]
      : NEGATIVE_SNIPPETS[Math.floor(rand() * NEGATIVE_SNIPPETS.length)];

    const prefix = positive ? '🔥 Fans say' : '😬 Concerned voice says';
    samples.push(`${prefix} ${request.subject} ${baseText}.`);
  }

  return samples;
}
