import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { SentimentConfig } from './types.js';

function loadEnvironmentVariables(): void {
  const moduleDir = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
  const repoRoot = path.resolve(moduleDir, '../../../');

  const candidates = [
    path.resolve(moduleDir, '../.env'),
    path.resolve(moduleDir, '../.env.local'),
    path.resolve(repoRoot, '.env'),
    path.resolve(repoRoot, '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local')
  ];

  let loadedAny = false;

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const result = dotenv.config({ path: candidate });
      if (!result.error) {
        loadedAny = true;
      }
    }
  }

  if (!loadedAny) {
    dotenv.config();
  }
}

loadEnvironmentVariables();

type Env = Record<string, string | undefined>;

const runtimeEnv: Env = (globalThis as any)?.process?.env ?? {};

function readEnv(env: Env): SentimentConfig {
  return {
    twitterBearerToken: env.TWITTER_BEARER_TOKEN,
    twitterServiceEnabled: env.TWITTER_SENTIMENT_SERVICE !== 'false',
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
  } else if (!config.twitterBearerToken) {
    console.warn('[Sentiment MCP] TWITTER_BEARER_TOKEN not set, Twitter sentiment tool will operate in degraded mode.');
  }

  if (!config.redditClientId || !config.redditClientSecret || !config.redditUsername || !config.redditPassword || !config.redditAppName) {
    console.warn('[Sentiment MCP] Reddit credentials incomplete, Reddit sentiment tool will operate in degraded mode.');
  }
}
