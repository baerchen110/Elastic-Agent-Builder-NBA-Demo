import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname });

const token = process.env.TWITTER_BEARER_TOKEN;

if (!token) {
  console.error('Missing TWITTER_BEARER_TOKEN environment variable.');
  process.exit(1);
}

const params = new URLSearchParams({
  query: 'Stephen Curry lang:en -is:retweet',
  'tweet.fields': 'created_at,lang',
  max_results: '10'
});

const url = 'https://api.twitter.com/2/tweets/search/recent?' + params.toString();

try {
  const response = await axios.get(url, {
    headers: {
      Authorization: 'Bearer ' + token
    },
    timeout: 10000
  });

  console.log('Twitter API status:', response.status);
  console.log('Tweets returned:', Array.isArray(response.data?.data) ? response.data.data.length : 0);
} catch (error) {
  const status = error?.response?.status;
  const payload = error?.response?.data ?? error?.message;
  console.error('Twitter API error status:', status);
  console.error('Twitter API error payload:', payload);
  process.exit(1);
}
