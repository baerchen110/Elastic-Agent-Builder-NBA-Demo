/**
 * Simple LRU Cache for MCP tool results
 */

import { LRUCache } from 'lru-cache';
import { CacheConfig } from './types.js';
import crypto from 'crypto';

export class MCPCache {
  private cache: LRUCache<string, any>;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: CacheConfig) {
    this.cache = new LRUCache({
      max: config.maxSize,
      ttl: config.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
  }

  /**
   * Generate cache key from server ID, tool name, and parameters
   */
  private generateKey(serverId: string, toolName: string, parameters: Record<string, any>): string {
    // Sort parameters to ensure consistent keys
    const sortedParams = Object.keys(parameters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = parameters[key];
        return acc;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sortedParams);
    const hash = crypto.createHash('md5').update(paramsString).digest('hex');

    return `${serverId}:${toolName}:${hash}`;
  }

  /**
   * Get cached result
   */
  get(serverId: string, toolName: string, parameters: Record<string, any>): any | undefined {
    const key = this.generateKey(serverId, toolName, parameters);
    const result = this.cache.get(key);

    if (result !== undefined) {
      this.hits++;
      console.log(`[Cache] HIT for ${serverId}:${toolName}`);
      return result;
    }

    this.misses++;
    console.log(`[Cache] MISS for ${serverId}:${toolName}`);
    return undefined;
  }

  /**
   * Set cached result
   */
  set(serverId: string, toolName: string, parameters: Record<string, any>, result: any): void {
    const key = this.generateKey(serverId, toolName, parameters);
    this.cache.set(key, result);
    console.log(`[Cache] SET for ${serverId}:${toolName}`);
  }

  /**
   * Check if result is cached
   */
  has(serverId: string, toolName: string, parameters: Record<string, any>): boolean {
    const key = this.generateKey(serverId, toolName, parameters);
    return this.cache.has(key);
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log('[Cache] Cleared all entries');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: parseFloat(hitRate.toFixed(2))
    };
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }
}
