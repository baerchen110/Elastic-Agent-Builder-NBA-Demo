/**
 * Direct test of TwitterAPI.io endpoints
 * Run with: npx tsx test-twitter-direct.mts
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const API_KEY = process.env.TWITTERAPI_API_KEY;

if (!API_KEY) {
  console.error('❌ TWITTERAPI_API_KEY not found in .env.local');
  process.exit(1);
}

console.log('🔑 API Key loaded:', API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 4));
console.log('   Length:', API_KEY.length, 'characters');

const http = axios.create({
  baseURL: 'https://api.twitterapi.io/twitter',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'User-Agent': 'Sentiment-MCP-Server/0.1.0'
  }
});

async function testUserInfo(username: string) {
  console.log(`\n📋 Testing user info for @${username}...`);
  try {
    const response = await http.get('/user/info', {
      params: { userName: username }
    });
    console.log('Raw response:', JSON.stringify(response.data, null, 2));
    console.log('✅ User info retrieved:');
    console.log('   User ID:', response.data?.user?.userId);
    console.log('   Name:', response.data?.user?.name);
    console.log('   Username:', response.data?.user?.userName);
    return response.data?.user?.userId;
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testUserTweets(username: string, pageSize = 10) {
  console.log(`\n🐦 Testing tweets for @${username}...`);
  try {
    const response = await http.get('/user/last_tweets', {
      params: {
        userName: username,
        pageSize
      }
    });

    const tweets = response.data?.data?.tweets || [];
    console.log(`✅ Fetched ${tweets.length} tweets`);

    if (tweets.length > 0) {
      console.log('\n📝 Sample tweets:\n');
      tweets.slice(0, 3).forEach((tweet: any, index: number) => {
        console.log(`${index + 1}. @${tweet.author?.userName}: ${tweet.text?.substring(0, 100)}...`);
        console.log(`   Created: ${tweet.createdAt}`);
        console.log(`   Likes: ${tweet.publicMetrics?.likes || 0}, Retweets: ${tweet.publicMetrics?.retweets || 0}\n`);
      });
    }

    return tweets;
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  const testUsername = 'wojespn';

  console.log('🏀 Testing TwitterAPI.io Integration\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Get user info
    await testUserInfo(testUsername);

    // Test 2: Fetch tweets
    const tweets = await testUserTweets(testUsername, 10);

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed!');
    console.log(`\nSuccessfully fetched ${tweets.length} tweets from @${testUsername}`);

  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.error('❌ Tests failed');
    process.exit(1);
  }
}

main();
