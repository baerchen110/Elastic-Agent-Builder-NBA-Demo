import axios, { AxiosInstance } from 'axios';
import pRetry from 'p-retry';
import { SentimentEngine } from '../analysis/sentiment-engine.js';
import { buildFallbackSamples } from '../utils/fallback.js';
import { SentimentConfig, SentimentRequest, SentimentSummary } from '../types.js';
import { getPlayerSubreddits, buildRedditSearchQuery } from '../constants/nba-subreddits.js';

interface RedditSearchItem {
  id: string;
  title: string;
  selftext?: string;
  subreddit: string;
  created_utc: number;
}

interface RedditSearchResponse {
  data?: {
    children: Array<{
      data: RedditSearchItem;
    }>;
  };
}

export class RedditSentimentService {
  private readonly http: AxiosInstance;
  private readonly config: SentimentConfig;
  private readonly engine: SentimentEngine;
  private oauthToken: { token: string; expiresAt: number } | null = null;
  private readonly userAgent: string;

  constructor(config: SentimentConfig, engine: SentimentEngine = new SentimentEngine(), http?: AxiosInstance) {
    this.config = config;
    this.engine = engine;
    this.http = http ?? axios.create({
      baseURL: 'https://oauth.reddit.com',
      timeout: 10_000
    });
    this.userAgent = config.redditAppName && config.redditUsername
      ? `${config.redditAppName}/0.1 by ${config.redditUsername}`
      : 'sentiment-mcp/0.1.0';
  }

  async getSentiment(request: SentimentRequest): Promise<SentimentSummary> {
    const windowMinutes = request.windowMinutes ?? this.config.defaultWindowMinutes;
    const maxSamples = request.maxSamples ?? this.config.maxSamples;

    console.error('[Sentiment][Reddit] Incoming sentiment request', {
      subject: request.subject,
      windowMinutes,
      maxSamples,
      filters: request.filters?.subreddits ?? null
    });

    let texts: string[] = [];
    let degradedReason: string | undefined;

    if (!this.hasCredentials()) {
      degradedReason = 'Reddit credentials missing';
      console.warn('[Sentiment][Reddit] Skipping Reddit fetch due to missing credentials', {
        subject: request.subject
      });
    } else {
      try {
        texts = await this.fetchPosts(request, windowMinutes, maxSamples);
        console.info('[Sentiment][Reddit] Fetch successful', {
          subject: request.subject,
          samples: texts.length
        });
      } catch (error: any) {
        degradedReason = `Reddit API unavailable: ${error?.message ?? 'unknown error'}`;
        console.warn('[Sentiment][Reddit] Fetch failed', {
          subject: request.subject,
          error: error?.message ?? error
        });
      }
    }

    if (!texts.length) {
      texts = buildFallbackSamples(request, 'reddit', maxSamples);
      console.info('[Sentiment][Reddit] Using fallback samples', {
        subject: request.subject,
        fallbackCount: texts.length
      });
    }

    const summary = this.engine.analyze(texts, {
      source: 'reddit',
      subject: request.subject,
      windowMinutes,
      maxSamples
    });

    const metadataNotes: string[] = [];
    if (degradedReason) {
      metadataNotes.push(degradedReason);
      summary.tags.push('degraded');
    } else {
      metadataNotes.push(`Reddit sample size: ${summary.sampleSize}`);
    }

    summary.notes = metadataNotes.join(' | ');
    return summary;
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.config.redditClientId &&
        this.config.redditClientSecret &&
        this.config.redditUsername &&
        this.config.redditPassword &&
        this.config.redditAppName
    );
  }

  private async ensureOAuthToken(): Promise<string> {
    if (!this.hasCredentials()) {
      throw new Error('Missing Reddit credentials');
    }

    if (this.oauthToken && this.oauthToken.expiresAt > Date.now() + 60_000) {
      console.info('[Sentiment][Reddit] Reusing cached OAuth token');
      return this.oauthToken.token;
    }

    const bufferApi = (globalThis as any)?.Buffer;
    if (!bufferApi?.from) {
      throw new Error('Buffer API not available in runtime environment');
    }

    const auth = bufferApi.from(
      `${this.config.redditClientId}:${this.config.redditClientSecret}`
    ).toString('base64');

    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'password',
        username: this.config.redditUsername as string,
        password: this.config.redditPassword as string
      }),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent
        },
        timeout: 10_000
      }
    );

    const { access_token: token, expires_in: expiresIn } = response.data as { access_token: string; expires_in: number };
    this.oauthToken = {
      token,
      expiresAt: Date.now() + expiresIn * 1000
    };

    console.info('[Sentiment][Reddit] Obtained new OAuth token', {
      expiresInSeconds: expiresIn
    });

    return token;
  }

  private async fetchPosts(request: SentimentRequest, windowMinutes: number, maxSamples: number): Promise<string[]> {
    const token = await this.ensureOAuthToken();
    const earliestTimestamp = Date.now() - windowMinutes * 60_000;

    // Auto-detect player-specific subreddits if not explicitly provided
    const explicitSubreddits = Array.isArray(request.filters?.subreddits)
      ? request.filters!.subreddits.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    const targetSubreddits = explicitSubreddits.length > 0
      ? explicitSubreddits
      : getPlayerSubreddits(request.subject);

    console.error('[Sentiment][Reddit] Fetching posts', {
      subject: request.subject,
      earliestTimestamp,
      maxSamples,
      targetSubreddits,
      autoDetected: explicitSubreddits.length === 0
    });

    const aggregated: string[] = [];
    for (const subreddit of targetSubreddits) {
      const items = await this.searchPosts(token, request.subject, maxSamples, earliestTimestamp, subreddit);
      aggregated.push(...this.extractTexts(items, earliestTimestamp));
      if (aggregated.length >= maxSamples) {
        break;
      }
    }
    return aggregated.slice(0, maxSamples);
  }

  private async searchPosts(
    token: string,
    subject: string,
    maxSamples: number,
    earliestTimestamp: number,
    subreddit?: string
  ): Promise<RedditSearchItem[]> {
    const endpoint = subreddit
      ? `/r/${encodeURIComponent(subreddit)}/search`
      : '/search';

    // Use fuzzy matching with player name variations
    const searchQuery = buildRedditSearchQuery(subject);

    const params = {
      q: searchQuery,
      sort: 'new',
      limit: Math.min(maxSamples, 100),
      restrict_sr: Boolean(subreddit),
      type: 'link'
    } as const;

    const response = await pRetry(async (attempt: number) => {
      console.info('[Sentiment][Reddit] Fetch attempt', {
        attempt,
        endpoint,
        subject,
        params
      });
      try {
        const res = await this.http.get<RedditSearchResponse>(endpoint, {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': this.userAgent
          }
        });

        const itemCount = res.data?.data?.children?.length ?? 0;
        console.info('[Sentiment][Reddit] Fetch response', {
          attempt,
          endpoint,
          subject,
          itemCount
        });

        return res;
      } catch (error: any) {
        console.warn('[Sentiment][Reddit] Fetch attempt failed', {
          attempt,
          endpoint,
          subject,
          status: error?.response?.status,
          error: error?.message ?? error
        });
        throw error;
      }
    }, { retries: 2, factor: 1.6 });

    const children: Array<{ data: RedditSearchItem }> = response.data?.data?.children ?? [];
    const items: RedditSearchItem[] = children.map(child => child.data);

    if (!subreddit) {
      return items.filter(item => item.created_utc * 1000 >= earliestTimestamp);
    }

    return items;
  }

  private extractTexts(items: RedditSearchItem[], earliestTimestamp: number): string[] {
    const texts: string[] = [];
    for (const item of items) {
      if (item.created_utc * 1000 < earliestTimestamp) {
        continue;
      }
      const content = [item.title, item.selftext].filter(Boolean).join(' ');
      if (content) {
        texts.push(`[r/${item.subreddit}] ${content}`);
      }
    }
    return texts;
  }
}
