/**
 * TwitterAPI.io Adapter
 *
 * Direct HTTP client for TwitterAPI.io REST API.
 * Handles tweet fetching, query construction, and text extraction.
 */

import axios, { AxiosInstance } from 'axios';
import pRetry from 'p-retry';

/**
 * Search options for tweet queries
 */
export interface TwitterSearchOptions {
  maxResults: number;
  startTime?: Date;
  cursor?: string;
}

/**
 * User ID mapping cache
 */
interface UserIdCache {
  [username: string]: string;
}

/**
 * Tweet object from twitterapi-mcp
 * (Based on inferred structure from twitterapi.io responses)
 */
interface TwitterApiTweet {
  id?: string;
  text?: string;
  full_text?: string;
  created_at?: string;
  user?: {
    screen_name?: string;
    name?: string;
  };
  retweeted?: boolean;
  lang?: string;
}

/**
 * Search response from twitterapi-mcp
 */
interface TwitterSearchResponse {
  tweets?: TwitterApiTweet[];
  data?: TwitterApiTweet[];
  statuses?: TwitterApiTweet[];
  next_cursor?: string;
  error?: string;
}

/**
 * Adapter for TwitterAPI.io MCP server integration
 *
 * Provides a clean interface for fetching and processing tweets
 * for sentiment analysis purposes.
 */
export class TwitterApiAdapter {
  private readonly apiKey: string;
  private readonly http: AxiosInstance;
  private readonly userIdCache: UserIdCache = {};

  /**
   * Initialize the adapter with API credentials
   *
   * @param apiKey - TwitterAPI.io API key
   * @param proxyUrl - Optional HTTP proxy URL for enterprise networks
   */
  constructor(apiKey: string, proxyUrl?: string) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('TwitterAPI.io API key is required');
    }

    this.apiKey = apiKey.trim();

    // Initialize HTTP client for TwitterAPI.io
    this.http = axios.create({
      baseURL: 'https://api.twitterapi.io/twitter',
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'User-Agent': 'Sentiment-MCP-Server/0.1.0'
      }
    });

    // Configure proxy if provided
    if (proxyUrl?.trim()) {
      console.error('[TwitterApiAdapter] Using proxy', { proxyUrl });
      // Note: Proxy configuration would go here if needed
      // For now, we'll skip proxy support for simplicity
    }

    console.error('[TwitterApiAdapter] Initialized HTTP client', {
      baseURL: this.http.defaults.baseURL,
      hasApiKey: !!this.apiKey
    });
  }

  /**
   * Test fetch from a single Twitter account
   * Useful for debugging and verification
   *
   * @param username - Twitter username (without @)
   * @param subject - Optional subject to filter for
   * @param limit - Number of tweets to fetch
   * @returns Array of tweet text strings
   */
  async testSingleAccount(username: string, subject: string | undefined, limit: number): Promise<string[]> {
    console.error('[TwitterApiAdapter] Testing single account', {
      username,
      subject: subject || 'all tweets',
      limit
    });

    try {
      const tweets = await this.fetchUserTimeline(username, limit);

      // Filter by subject if provided
      const filtered = subject
        ? tweets.filter(tweet => {
            const text = (tweet.full_text || tweet.text || '').toLowerCase();
            return text.includes(subject.toLowerCase());
          })
        : tweets;

      const texts = this.extractTexts(filtered);

      console.info('[TwitterApiAdapter] Single account test successful', {
        username,
        totalFetched: tweets.length,
        matchedSubject: filtered.length,
        textsExtracted: texts.length
      });

      return texts;
    } catch (error: any) {
      console.error('[TwitterApiAdapter] Single account test failed', {
        username,
        error: error?.message ?? error
      });
      throw new Error(`Failed to fetch from @${username}: ${error?.message ?? 'Unknown error'}`);
    }
  }

  /**
   * Search for tweets matching a query
   * Uses user timeline fetching for NBA insider accounts to ensure accuracy
   *
   * @param subject - The subject to search for (player name, team, topic)
   * @param options - Search options (max results, time window, cursor)
   * @returns Array of tweet text strings
   */
  async searchTweets(subject: string, options: TwitterSearchOptions): Promise<string[]> {
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      throw new Error('Search subject is required');
    }

    console.error('[TwitterApiAdapter] Searching tweets from NBA insider timelines', {
      subject,
      maxResults: options.maxResults,
      hasStartTime: !!options.startTime
    });

    try {
      // Fetch tweets from each NBA insider account's timeline
      const allTweets = await this.fetchFromInsiderTimelines(subject, options);
      const texts = this.extractTexts(allTweets);

      console.info('[TwitterApiAdapter] Fetch successful', {
        subject,
        tweetsFound: allTweets.length,
        textsExtracted: texts.length
      });

      return texts;
    } catch (error: any) {
      console.error('[TwitterApiAdapter] Fetch failed after retries', {
        subject,
        error: error?.message ?? error
      });
      throw new Error(`Failed to fetch tweets: ${error?.message ?? 'Unknown error'}`);
    }
  }

  /**
   * Fetch tweets from NBA insider account timelines
   * More reliable than search queries with TwitterAPI.io
   *
   * @param subject - Subject to filter for
   * @param options - Search options
   * @returns Array of tweet objects that mention the subject
   */
  private async fetchFromInsiderTimelines(
    subject: string,
    options: TwitterSearchOptions
  ): Promise<TwitterApiTweet[]> {
    const insiderAccounts = [
      'wojespn',
      'ShamsCharania',
      'TheSteinLine',
      'NBA',
      'nbastats',
      'johnschuhmann',
      'TheAthleticNBA',
      'KevinOConnorNBA',
      'WindhorstESPN'
    ];

    const tweetsPerAccount = Math.ceil(options.maxResults / insiderAccounts.length);
    const allTweets: TwitterApiTweet[] = [];

    console.error('[TwitterApiAdapter] Fetching from insider timelines', {
      accounts: insiderAccounts.length,
      tweetsPerAccount,
      subject
    });

    // Fetch tweets from each account in parallel
    const fetchPromises = insiderAccounts.map(async (username) => {
      try {
        return await pRetry(
          async () => {
            const tweets = await this.fetchUserTimeline(username, tweetsPerAccount);

            // Filter tweets that mention the subject (case-insensitive)
            const subjectLower = subject.toLowerCase();
            const filtered = tweets.filter(tweet => {
              const text = (tweet.full_text || tweet.text || '').toLowerCase();
              return text.includes(subjectLower);
            });

            console.error('[TwitterApiAdapter] Timeline fetched', {
              username,
              total: tweets.length,
              matched: filtered.length
            });

            return filtered;
          },
          {
            retries: 2,
            minTimeout: 500,
            maxTimeout: 2000,
            onFailedAttempt: (error) => {
              console.warn('[TwitterApiAdapter] Timeline fetch failed', {
                username,
                attempt: error.attemptNumber,
                retriesLeft: error.retriesLeft
              });
            }
          }
        );
      } catch (error: any) {
        console.warn('[TwitterApiAdapter] Skipping account after failures', {
          username,
          error: error?.message
        });
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);

    // Flatten and combine all tweets
    for (const accountTweets of results) {
      allTweets.push(...accountTweets);
    }

    // Sort by created_at (most recent first)
    allTweets.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    // Apply time filter if specified
    const filtered = options.startTime
      ? this.filterByTimeWindow(allTweets, options.startTime)
      : allTweets;

    // Limit to maxResults
    return filtered.slice(0, options.maxResults);
  }

  /**
   * Get user ID for a username (with caching)
   *
   * @param username - Twitter username (without @)
   * @returns User ID
   */
  private async getUserId(username: string): Promise<string> {
    // Check cache first
    if (this.userIdCache[username]) {
      return this.userIdCache[username];
    }

    try {
      const response = await this.http.get('/user/info', {
        params: { userName: username }
      });

      // TwitterAPI.io returns data in response.data.data.id
      const userId = response.data?.data?.id?.toString();

      if (!userId) {
        throw new Error(`No user ID found for @${username}`);
      }

      // Cache the result
      this.userIdCache[username] = userId;

      console.error('[TwitterApiAdapter] User ID resolved', {
        username,
        userId
      });

      return userId;
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 404) {
        throw new Error(`User @${username} not found`);
      }

      throw new Error(`Failed to get user ID for @${username}: ${error?.message}`);
    }
  }

  /**
   * Fetch tweets from a user's timeline using username
   *
   * @param username - Twitter username (without @)
   * @param count - Number of tweets to fetch
   * @returns Array of tweet objects
   */
  private async fetchUserTimeline(username: string, count: number): Promise<TwitterApiTweet[]> {
    try {
      const response = await this.http.get('/user/last_tweets', {
        params: {
          userName: username,
          pageSize: Math.min(count, 100)
        }
      });

      // TwitterAPI.io returns tweets in response.data.data.tweets array
      const tweets = response.data?.data?.tweets || [];

      // Convert TwitterAPI.io format to our internal format
      return tweets.map((tweet: any) => ({
        id: tweet.id?.toString(),
        text: tweet.text,
        full_text: tweet.text,
        created_at: tweet.createdAt,
        user: {
          screen_name: tweet.author?.userName,
          name: tweet.author?.name
        },
        retweeted: false,
        lang: tweet.lang || 'en'
      }));
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        throw new Error('TwitterAPI.io authentication failed - check API key');
      }

      if (status === 429) {
        throw new Error('TwitterAPI.io rate limit exceeded - retry later');
      }

      throw new Error(`Failed to fetch timeline: ${error?.message}`);
    }
  }


  /**
   * Extract tweet objects from various response formats
   * TwitterAPI.io may return different structures
   *
   * @param response - API response
   * @returns Array of tweet objects
   */
  private extractTweetsFromResponse(response: any): TwitterApiTweet[] {
    if (!response) {
      return [];
    }

    // Try different response structures
    if (Array.isArray(response)) {
      return response;
    }

    if (response.tweets && Array.isArray(response.tweets)) {
      return response.tweets;
    }

    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }

    if (response.statuses && Array.isArray(response.statuses)) {
      return response.statuses;
    }

    console.warn('[TwitterApiAdapter] Unexpected response format', {
      responseKeys: Object.keys(response)
    });

    return [];
  }

  /**
   * Filter tweets by time window
   *
   * @param tweets - Array of tweets
   * @param startTime - Earliest allowed time
   * @returns Filtered tweets
   */
  private filterByTimeWindow(tweets: TwitterApiTweet[], startTime: Date): TwitterApiTweet[] {
    const startTimestamp = startTime.getTime();

    return tweets.filter((tweet) => {
      if (!tweet.created_at) {
        return true; // Include tweets without timestamp
      }

      try {
        const tweetTime = new Date(tweet.created_at).getTime();
        return tweetTime >= startTimestamp;
      } catch {
        return true; // Include if we can't parse the date
      }
    });
  }

  /**
   * Extract text content from tweet objects
   * Handles different text field names and filters invalid entries
   *
   * @param tweets - Array of tweet objects
   * @returns Array of text strings
   */
  private extractTexts(tweets: TwitterApiTweet[]): string[] {
    const texts: string[] = [];

    for (const tweet of tweets) {
      // Skip retweets (double-check even if filtered in query)
      if (tweet.retweeted) {
        continue;
      }

      // Extract text from various possible fields
      const text = tweet.full_text || tweet.text;

      // Validate text content
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        continue;
      }

      // Filter out non-English tweets if language is specified
      if (tweet.lang && tweet.lang !== 'en') {
        continue;
      }

      texts.push(text.trim());
    }

    console.error('[TwitterApiAdapter] Extracted texts', {
      totalTweets: tweets.length,
      validTexts: texts.length,
      filtered: tweets.length - texts.length
    });

    return texts;
  }

  /**
   * Get adapter status information
   * Useful for debugging and monitoring
   */
  getStatus(): { configured: boolean; baseURL: string } {
    return {
      configured: !!this.apiKey,
      baseURL: this.http.defaults.baseURL || 'unknown'
    };
  }
}
