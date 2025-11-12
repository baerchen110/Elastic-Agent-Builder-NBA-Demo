export interface SentimentSample {
  id: string;
  text: string;
  author?: string;
  timestamp?: string;
  score: number; // range [-1, 1]
  confidence: number; // range [0, 1]
  metadata?: Record<string, unknown>;
}

export interface SentimentSummary {
  source: 'twitter' | 'reddit' | 'narrative' | 'aggregate';
  subject: string;
  averageScore: number;
  confidence: number;
  samples: SentimentSample[];
  sampleSize: number;
  tags: string[];
  generatedAt: string;
  notes?: string;
}

export interface AggregatedSentimentSummary extends SentimentSummary {
  breakdown: Array<{
    source: Exclude<SentimentSummary['source'], 'aggregate'>;
    averageScore: number;
    confidence: number;
    sampleSize: number;
  }>;
}

export interface SentimentRequest {
  subject: string;
  windowMinutes?: number;
  maxSamples?: number;
  filters?: Record<string, unknown>;
}

export interface SentimentConfig {
  twitterBearerToken?: string;
  twitterServiceEnabled: boolean;
  redditClientId?: string;
  redditClientSecret?: string;
  redditUsername?: string;
  redditPassword?: string;
  redditAppName?: string;
  defaultWindowMinutes: number;
  maxSamples: number;
}
