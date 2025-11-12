import axios, { AxiosInstance } from 'axios';
import pRetry from 'p-retry';
import { SentimentEngine } from '../analysis/sentiment-engine.js';
import { buildFallbackSamples } from '../utils/fallback.js';
import { SentimentConfig, SentimentRequest, SentimentSummary } from '../types.js';

interface TwitterTweet {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
}

export class TwitterSentimentService {
  private readonly http: AxiosInstance;
  private readonly config: SentimentConfig;
  private readonly engine: SentimentEngine;

  constructor(config: SentimentConfig, engine: SentimentEngine = new SentimentEngine(), http?: AxiosInstance) {
    this.config = config;
    this.engine = engine;
    this.http = http ?? axios.create({
      baseURL: 'https://api.twitter.com/2',
      timeout: 10_000
    });
  }

  async getSentiment(request: SentimentRequest): Promise<SentimentSummary> {
    const windowMinutes = request.windowMinutes ?? this.config.defaultWindowMinutes;
    const maxSamples = request.maxSamples ?? this.config.maxSamples;

    console.info('[Sentiment][Twitter] Incoming sentiment request', {
      subject: request.subject,
      windowMinutes,
      maxSamples
    });

    let texts: string[] = [];
    let degradedReason: string | undefined;

    if (!this.config.twitterBearerToken) {
      degradedReason = 'Twitter credentials missing';
      console.warn('[Sentiment][Twitter] Skipping Twitter fetch due to missing credentials', {
        subject: request.subject
      });
    } else {
      try {
        texts = await this.fetchTweets(request, windowMinutes, maxSamples);
        console.info('[Sentiment][Twitter] Fetch successful', {
          subject: request.subject,
          samples: texts.length
        });
      } catch (error: any) {
        degradedReason = `Twitter API unavailable: ${error?.message ?? 'unknown error'}`;
        console.warn('[Sentiment][Twitter] Fetch failed', {
          subject: request.subject,
          error: error?.message ?? error
        });
      }
    }

    if (!texts.length) {
      texts = buildFallbackSamples(request, 'twitter', maxSamples);
      console.info('[Sentiment][Twitter] Using fallback samples', {
        subject: request.subject,
        fallbackCount: texts.length
      });
    }

    const summary = this.engine.analyze(texts, {
      source: 'twitter',
      subject: request.subject,
      windowMinutes,
      maxSamples
    });

    const metadataNotes: string[] = [];
    if (degradedReason) {
      metadataNotes.push(degradedReason);
      summary.tags.push('degraded');
    } else {
      metadataNotes.push(`Twitter sample size: ${summary.sampleSize}`);
    }

    summary.notes = metadataNotes.join(' | ');
    return summary;
  }

  private async fetchTweets(request: SentimentRequest, windowMinutes: number, maxSamples: number): Promise<string[]> {
    if (!this.config.twitterBearerToken) {
      return [];
    }

    const startTime = new Date(Date.now() - windowMinutes * 60_000).toISOString();
    const params = {
      query: `${request.subject} lang:en -is:retweet`,
      'tweet.fields': 'created_at,lang',
      max_results: Math.min(maxSamples, 100),
      start_time: startTime
    } as const;

    const response = await pRetry(async (attempt: number) => {
      console.info('[Sentiment][Twitter] Fetch attempt', {
        attempt,
        subject: request.subject,
        params
      });
      try {
        const res = await this.http.get<TwitterSearchResponse>('/tweets/search/recent', {
          params,
          headers: {
            Authorization: `Bearer ${this.config.twitterBearerToken}`
          }
        });

        const tweetCount = res.data?.data?.length ?? 0;
        console.info('[Sentiment][Twitter] Fetch response', {
          attempt,
          subject: request.subject,
          tweetCount
        });

        return res;
      } catch (error: any) {
        console.warn('[Sentiment][Twitter] Fetch attempt failed', {
          attempt,
          subject: request.subject,
          status: error?.response?.status,
          error: error?.message ?? error
        });
        throw error;
      }
    }, { retries: 2, factor: 1.5 });

    const tweets: TwitterTweet[] = response.data?.data ?? [];
    return tweets
      .filter((tweet) => !tweet.lang || tweet.lang === 'en')
      .map((tweet) => tweet.text);
  }
}
