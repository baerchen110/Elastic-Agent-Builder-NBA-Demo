import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname });

const {
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME,
  REDDIT_PASSWORD,
  REDDIT_APP_NAME
} = process.env;

if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD || !REDDIT_APP_NAME) {
  console.error('Missing one or more Reddit credentials in environment variables.');
  process.exit(1);
}

const userAgent = `${REDDIT_APP_NAME}`;

try {
  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  const tokenResponse = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    new URLSearchParams({
      grant_type: 'password',
      username: REDDIT_USERNAME,
      password: REDDIT_PASSWORD
    }),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent
      },
      timeout: 10000
    }
  );

  const token = tokenResponse.data?.access_token;
  const expires = tokenResponse.data?.expires_in;

  if (!token) {
    console.error('Reddit OAuth did not return an access token.', tokenResponse.data);
    process.exit(1);
  }

  console.log('Reddit OAuth status: 200');
  console.log('Access token expires in (s):', expires);

  const searchResponse = await axios.get('https://oauth.reddit.com/search', {
    params: {
      q: 'Stephen Curry',
      sort: 'new',
      limit: 5,
      type: 'link'
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent
    },
    timeout: 10000
  });

  const items = searchResponse.data?.data?.children ?? [];
  console.log('Reddit search status:', searchResponse.status);
  console.log('Posts returned:', items.length);
} catch (error) {
  const status = error?.response?.status;
  const payload = error?.response?.data ?? error?.message;
  console.error('Reddit API error status:', status);
  console.error('Reddit API error payload:', payload);
  process.exit(1);
}
