/**
 * Test script to verify Twitter query construction and API responses
 * Run with: npx tsx test-twitter-query.mts
 */

import { TwitterApiAdapter } from './src/adapters/twitterapi-adapter.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

async function testTwitterQuery() {
  const apiKey = process.env.TWITTER_BEARER_TOKEN;

  if (!apiKey) {
    console.error('❌ TWITTER_BEARER_TOKEN not found in .env.local');
    console.log('\nTo test with real API:');
    console.log('1. Add TWITTER_BEARER_TOKEN to .env.local');
    console.log('2. Run: npx tsx test-twitter-query.mts\n');
    return;
  }

  console.log('🔍 Testing Twitter Query Construction and API Response\n');

  const adapter = new TwitterApiAdapter(apiKey);
  const testSubject = 'Stephen Curry';

  console.log(`📊 Test subject: ${testSubject}`);
  console.log('⏳ Fetching tweets...\n');

  try {
    const tweets = await adapter.searchTweets(testSubject, {
      maxResults: 10
    });

    console.log(`✅ Successfully fetched ${tweets.length} tweets\n`);

    if (tweets.length > 0) {
      console.log('📝 Sample tweets:\n');
      tweets.slice(0, 5).forEach((tweet, index) => {
        console.log(`${index + 1}. ${tweet.substring(0, 150)}${tweet.length > 150 ? '...' : ''}`);
        console.log('');
      });

      // Check for gambling-related keywords
      const gamblingKeywords = ['bet', 'odds', 'spread', 'line', 'parlay', 'wager', 'DraftKings', 'FanDuel'];
      const gamblingTweets = tweets.filter(tweet =>
        gamblingKeywords.some(keyword => tweet.toLowerCase().includes(keyword.toLowerCase()))
      );

      if (gamblingTweets.length > 0) {
        console.log(`⚠️  WARNING: Found ${gamblingTweets.length} tweets with gambling content:`);
        gamblingTweets.forEach((tweet, index) => {
          console.log(`\n${index + 1}. ${tweet}`);
        });
        console.log('\n🔍 This suggests the query filtering is NOT working as expected.');
        console.log('   The NBA insider accounts should not be posting gambling content.');
      } else {
        console.log('✅ No gambling content detected in results.');
        console.log('   Query filtering is working correctly.');
      }
    } else {
      console.log('⚠️  No tweets found. This could mean:');
      console.log('   1. The accounts haven\'t tweeted about this subject recently');
      console.log('   2. The TwitterAPI.io service may not support the "from:" operator');
      console.log('   3. There may be an API rate limit or authentication issue');
    }

  } catch (error: any) {
    console.error('❌ Error fetching tweets:', error.message);

    if (error.message.includes('authentication')) {
      console.log('\n💡 Check that your TWITTER_BEARER_TOKEN is valid');
    } else if (error.message.includes('rate limit')) {
      console.log('\n💡 Twitter API rate limit reached. Try again later.');
    }
  }
}

testTwitterQuery().catch(console.error);
