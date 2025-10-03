/**
 * Request-Level Caching Utility
 *
 * Implements a simple in-memory LRU cache with TTL (Time To Live) expiration
 * for frequently accessed problem and company data.
 *
 * Purpose:
 * - Reduce Firestore read latency for repeated requests
 * - Optimize for rapid successive requests (common during development/testing)
 * - Short TTL ensures data freshness while providing performance benefits
 *
 * Cache Strategy:
 * - LRU (Least Recently Used) eviction policy
 * - 10-second TTL for data freshness
 * - Maximum 100 entries to prevent memory bloat
 * - Separate caches for problems and companies
 */

import { Problem } from '@/data-types/problem';
import type { Company } from '@/data-types/company';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttlSeconds: number = 10) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns Cached value or null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param data - Data to cache
   */
  set(key: string, data: T): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Add/update entry
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttl / 1000
    };
  }
}

// Create singleton cache instances
const problemCache = new LRUCache<Problem>(100, 10);
const companyCache = new LRUCache<Company>(50, 10);

/**
 * Get a problem from cache or return null
 */
export function getCachedProblem(problemId: string): Problem | null {
  return problemCache.get(problemId);
}

/**
 * Cache a problem
 */
export function cacheProblem(problemId: string, problem: Problem): void {
  problemCache.set(problemId, problem);
}

/**
 * Get a company from cache or return null
 */
export function getCachedCompany(companyId: string): Company | null {
  return companyCache.get(companyId);
}

/**
 * Cache a company
 */
export function cacheCompany(companyId: string, company: Company): void {
  companyCache.set(companyId, company);
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  problemCache.clear();
  companyCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    problems: problemCache.getStats(),
    companies: companyCache.getStats()
  };
}
