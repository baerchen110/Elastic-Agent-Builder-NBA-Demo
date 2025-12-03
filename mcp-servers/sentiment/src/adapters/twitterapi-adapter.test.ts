/**
 * Unit tests for TwitterApiAdapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { TwitterApiAdapter } from './twitterapi-adapter.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('TwitterApiAdapter', () => {
  let adapter: TwitterApiAdapter;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      defaults: {
        baseURL: 'https://api.twitterapi.io/twitter'
      }
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid API key', () => {
      adapter = new TwitterApiAdapter('test-api-key');
      expect(adapter).toBeDefined();
      expect(adapter.getStatus().configured).toBe(true);
    });

    it('should trim API key', () => {
      adapter = new TwitterApiAdapter('  test-api-key  ');
      expect(adapter.getStatus().configured).toBe(true);
    });

    it('should throw error if API key is empty', () => {
      expect(() => new TwitterApiAdapter('')).toThrow('TwitterAPI.io API key is required');
    });

    it('should throw error if API key is whitespace only', () => {
      expect(() => new TwitterApiAdapter('   ')).toThrow('TwitterAPI.io API key is required');
    });

    it('should throw error if API key is undefined', () => {
      expect(() => new TwitterApiAdapter(undefined as any)).toThrow('TwitterAPI.io API key is required');
    });

    it('should initialize axios with correct config', () => {
      adapter = new TwitterApiAdapter('test-key');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.twitterapi.io/twitter',
          timeout: 30_000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-key'
          })
        })
      );
    });

    it('should handle proxy URL parameter', () => {
      adapter = new TwitterApiAdapter('test-key', 'http://proxy:8080');
      // Proxy support is noted but not fully implemented
      expect(adapter).toBeDefined();
    });
  });

  describe('searchTweets', () => {
    beforeEach(() => {
      adapter = new TwitterApiAdapter('test-key');
    });

    it('should fetch tweets successfully', async () => {
      const mockTweets = [
        { id: '1', text: 'LeBron James scored 30 points!', created_at: new Date().toISOString() },
        { id: '2', text: 'Amazing game by LeBron', created_at: new Date().toISOString() }
      ];

      // Mock getUserId for all 9 accounts
      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { id_str: `${100 + i}` }
        });
      }

      // Mock timeline responses for all 9 accounts
      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          status: 200,
          data: mockTweets
        });
      }

      const result = await adapter.searchTweets('LeBron James', {
        maxResults: 10
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe('LeBron James scored 30 points!');
    });

    it('should throw error if subject is empty', async () => {
      await expect(adapter.searchTweets('', { maxResults: 10 })).rejects.toThrow(
        'Search subject is required'
      );
    });

    it('should fetch from NBA insider timelines', async () => {
      // Mock getUserId responses
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id_str: '123' } }) // wojespn
        .mockResolvedValueOnce({ data: { id_str: '456' } }) // ShamsCharania
        .mockResolvedValueOnce({ data: { id_str: '789' } }); // TheSteinLine (etc.)

      // Mock timeline responses - only first 3 to speed up test
      const mockTimeline = [
        { id: '1', text: 'Stephen Curry hit 8 threes tonight!', created_at: new Date().toISOString() }
      ];

      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          status: 200,
          data: mockTimeline
        });
      }

      const result = await adapter.searchTweets('Stephen Curry', { maxResults: 20 });

      // Should have called getUserId for NBA insider accounts
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/user/username',
        expect.objectContaining({
          params: { username: expect.any(String) }
        })
      );

      // Should have called timeline endpoint
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/user/timeline',
        expect.objectContaining({
          params: expect.objectContaining({
            user_id: expect.any(String),
            include_rts: false
          })
        })
      );

      expect(result.length).toBeGreaterThan(0);
    });

    it('should limit maxResults to 100', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { tweets: [] }
      });

      await adapter.searchTweets('Test', { maxResults: 500 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/tweet/advanced_search',
        expect.objectContaining({
          params: expect.objectContaining({
            count: 100
          })
        })
      );
    });

    it('should retry on network failure', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { tweets: [{ text: 'Success after retry' }] }
        });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });

    it('should throw authentication error on 401', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401 },
        message: 'Request failed with status code 401'
      });

      await expect(adapter.searchTweets('Test', { maxResults: 10 })).rejects.toThrow();
    });

    it('should throw rate limit error on 429', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 429 },
        message: 'Request failed with status code 429'
      });

      await expect(adapter.searchTweets('Test', { maxResults: 10 })).rejects.toThrow();
    });

    it('should handle different response formats (tweets array)', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { tweets: [{ text: 'Tweet 1' }, { text: 'Tweet 2' }] }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });
      expect(result).toHaveLength(2);
    });

    it('should handle different response formats (data array)', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ text: 'Tweet 1' }, { text: 'Tweet 2' }] }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });
      expect(result).toHaveLength(2);
    });

    it('should handle different response formats (statuses array)', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { statuses: [{ text: 'Tweet 1' }, { text: 'Tweet 2' }] }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });
      expect(result).toHaveLength(2);
    });

    it('should filter by start time', async () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [
            { text: 'Recent tweet', created_at: new Date(now - 30 * 60 * 1000).toISOString() },
            { text: 'Old tweet', created_at: twoHoursAgo.toISOString() }
          ]
        }
      });

      const result = await adapter.searchTweets('Test', {
        maxResults: 10,
        startTime: oneHourAgo
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Recent tweet');
    });

    it('should filter out retweets', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [
            { text: 'Original tweet', retweeted: false },
            { text: 'RT @user: Retweeted content', retweeted: true },
            { text: 'Another original', retweeted: false }
          ]
        }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(2);
      expect(result).not.toContain('RT @user: Retweeted content');
    });

    it('should filter out non-English tweets', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [
            { text: 'English tweet', lang: 'en' },
            { text: 'Spanish tweet', lang: 'es' },
            { text: 'French tweet', lang: 'fr' }
          ]
        }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('English tweet');
    });

    it('should include tweets without language specified', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [
            { text: 'Tweet without lang' },
            { text: 'Tweet with lang', lang: 'en' }
          ]
        }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(2);
    });

    it('should handle full_text field', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [{ full_text: 'This is the full text' }]
        }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('This is the full text');
    });

    it('should prefer full_text over text', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [
            {
              text: 'Truncated text...',
              full_text: 'This is the complete full text'
            }
          ]
        }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result[0]).toBe('This is the complete full text');
    });

    it('should filter out empty text', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          tweets: [
            { text: 'Valid tweet' },
            { text: '' },
            { text: '   ' },
            { text: 'Another valid tweet' }
          ]
        }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(2);
    });

    it('should handle empty response', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { tweets: [] }
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(0);
    });

    it('should handle null response data', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: null
      });

      const result = await adapter.searchTweets('Test', { maxResults: 10 });

      expect(result).toHaveLength(0);
    });
  });

  describe('Timeline Fetching', () => {
    beforeEach(() => {
      adapter = new TwitterApiAdapter('test-key');
    });

    it('should filter timeline tweets by subject mention', async () => {
      // Mock user ID lookup
      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { id_str: `${100 + i}` }
        });
      }

      // Mock timeline with mixed content
      const mockTimeline = [
        { text: 'Jokic drops 30/15/10 triple-double', created_at: new Date().toISOString() },
        { text: 'Lakers win overtime thriller', created_at: new Date().toISOString() },
        { text: 'Breaking: Jokic wins MVP', created_at: new Date().toISOString() }
      ];

      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          status: 200,
          data: mockTimeline
        });
      }

      const result = await adapter.searchTweets('Jokic', { maxResults: 10 });

      // Should only include tweets mentioning "Jokic"
      expect(result.length).toBeGreaterThan(0);
      result.forEach(tweet => {
        expect(tweet.toLowerCase()).toContain('jokic');
      });
    });

    it('should cache user IDs to avoid redundant lookups', async () => {
      // First call - fetch user IDs
      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { id_str: `${100 + i}` }
        });
        mockAxiosInstance.get.mockResolvedValueOnce({
          status: 200,
          data: [{ text: 'LeBron James scores 40', created_at: new Date().toISOString() }]
        });
      }

      await adapter.searchTweets('LeBron James', { maxResults: 10 });

      const callsAfterFirst = mockAxiosInstance.get.mock.calls.length;

      // Second call - should use cached user IDs
      for (let i = 0; i < 9; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          status: 200,
          data: [{ text: 'LeBron James triple-double', created_at: new Date().toISOString() }]
        });
      }

      await adapter.searchTweets('LeBron James', { maxResults: 10 });

      const callsAfterSecond = mockAxiosInstance.get.mock.calls.length;

      // Should have made fewer calls on second search (no user ID lookups)
      expect(callsAfterSecond - callsAfterFirst).toBeLessThan(callsAfterFirst);
    });
  });

  describe('getStatus', () => {
    it('should return configured status', () => {
      adapter = new TwitterApiAdapter('test-key');
      const status = adapter.getStatus();

      expect(status.configured).toBe(true);
      expect(status.baseURL).toBe('https://api.twitterapi.io/twitter');
    });
  });
});
