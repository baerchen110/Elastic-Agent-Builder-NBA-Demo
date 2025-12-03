import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnvFile } from 'dotenv';

import { SentimentConfig } from './types.js';

/**
 * Configuration for Sentiment MCP Server
 *
 * Environment variables are passed from the parent process (MCP aggregator)
 * which loads them from the root .env file. This ensures a single source of truth.
 *
 * When running standalone for testing, you can use dotenv or set env vars manually.
 */

type Env = Record<string, string | undefined>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hydrateProcessEnv(): void {
  const candidates = [
    path.resolve(__dirname, '..', '.env.local'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env')
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const result = loadEnvFile({ path: candidate, override: false });
    if (result.parsed) {
      console.info('[Config] Loaded environment variables from', path.relative(process.cwd(), candidate));
    }
  }
}

hydrateProcessEnv();

// Read from process.env - these are passed by the aggregator via stdio transport
const runtimeEnv: Env = process.env;

function readEnv(env: Env): SentimentConfig {
  console.error('[Config] Raw TWITTER_SENTIMENT_SERVICE value:', JSON.stringify(env.TWITTER_SENTIMENT_SERVICE));
  console.error('[Config] Raw TWITTERAPI_API_KEY present:', !!env.TWITTERAPI_API_KEY);

  // Respect the TWITTER_SENTIMENT_SERVICE flag - must be explicitly "true"
  // If not set, default to true only if API key is present (backward compatible)
  const twitterServiceEnabled = env.TWITTER_SENTIMENT_SERVICE === undefined
    ? !!env.TWITTERAPI_API_KEY
    : env.TWITTER_SENTIMENT_SERVICE === 'true';

  return {
    twitterApiKey: env.TWITTERAPI_API_KEY,
    twitterProxyUrl: env.TWITTERAPI_PROXY_URL,
    twitterServiceEnabled,
    redditClientId: env.REDDIT_CLIENT_ID,
    redditClientSecret: env.REDDIT_CLIENT_SECRET,
    redditUsername: env.REDDIT_USERNAME,
    redditPassword: env.REDDIT_PASSWORD,
    redditAppName: env.REDDIT_APP_NAME,
    defaultWindowMinutes: env.SENTIMENT_WINDOW_MINUTES
      ? Number(env.SENTIMENT_WINDOW_MINUTES)
      : 180,
    maxSamples: env.SENTIMENT_MAX_SAMPLES
      ? Number(env.SENTIMENT_MAX_SAMPLES)
      : 50
  };
}

export const sentimentConfig = readEnv(runtimeEnv);

export function validateConfig(config: SentimentConfig): void {
  if (!config.twitterServiceEnabled) {
    console.warn('[Sentiment MCP] TWITTER_SENTIMENT_SERVICE is disabled. Twitter sentiment data will not be used.');
  } else if (!config.twitterApiKey) {
    console.warn('[Sentiment MCP] TWITTERAPI_API_KEY not set, Twitter sentiment tool will operate in degraded mode (using mock data).');
  }

  if (!config.redditClientId || !config.redditClientSecret || !config.redditUsername || !config.redditPassword || !config.redditAppName) {
    console.warn('[Sentiment MCP] Reddit credentials incomplete, Reddit sentiment tool will operate in degraded mode.');
  }
}
