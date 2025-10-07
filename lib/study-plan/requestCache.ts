/**
 * Request-Level In-Memory Cache
 *
 * **Purpose**: Avoid redundant Firestore queries during study plan generation
 *
 * **Why This is Needed:**
 * Study plan generation requires:
 * 1. Load ALL problems (~2000 docs, ~500ms)
 * 2. Load ALL role scores (~2000 docs, ~500ms)
 * 3. Filter problems by difficulty/topics (needs ALL problems in memory)
 * 4. Calculate hotness for each problem (needs role scores + problems)
 * 5. Select diverse problems (needs to iterate problems multiple times)
 * 6. Generate schedule (needs problem metadata)
 *
 * Without cache: Would need to query Firestore 4-5 times = 2-3 seconds
 * With cache: Query once, use RAM for subsequent operations = 1 second
 *
 * **Where Data is Stored:**
 * - In Node.js process memory (RAM)
 * - Shared across concurrent API requests (if using same Node instance)
 * - Auto-expires after 5 minutes to prevent memory leaks
 * - Cleared on process restart (ephemeral)
 *
 * **Cache Strategy:**
 * - First request: Cache miss → Load from Firestore → Store in RAM
 * - Subsequent requests (within 5 min): Cache hit → Return from RAM
 * - After 5 min: Cache expired → Load fresh data from Firestore
 *
 * **Performance Impact:**
 * - Cache hit: 0ms (instant)
 * - Cache miss: 500-1000ms (Firestore collection scan)
 * - Expected hit rate: 60-80% (multiple users requesting plans)
 */

import { Problem } from '@/data-types/problem';
import { ProblemRoleScore } from './types';
import { Company } from '@/data-types/company';

/**
 * Cache entry with expiration timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * In-memory cache storage (Node.js process memory)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>();

/**
 * Default TTL: 5 minutes
 * After 5 minutes, data is considered stale and will be reloaded
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Check if cache entry is expired
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isExpired(entry: CacheEntry<any>, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - entry.timestamp > ttlMs;
}

/**
 * Get value from cache
 */
function get<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (isExpired(entry, ttlMs)) {
    // Expired - remove and return null
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Set value in cache
 */
function set<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clear all cache entries
 */
function clearAll(): void {
  cache.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
function getStats(): {
  totalEntries: number;
  entriesByKey: Record<string, number>;
  oldestEntry: number | null;
} {
  const entriesByKey: Record<string, number> = {};
  let oldestTimestamp = Date.now();

  for (const [key, entry] of cache.entries()) {
    const keyPrefix = key.split('-')[0];
    entriesByKey[keyPrefix] = (entriesByKey[keyPrefix] || 0) + 1;
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
  }

  return {
    totalEntries: cache.size,
    entriesByKey,
    oldestEntry: cache.size > 0 ? oldestTimestamp : null
  };
}

// ============================================================================
// Typed Cache Functions for Study Plan Data
// ============================================================================

/**
 * Cache all problems
 * Used by: problemSelector, hotnessCalculator, scheduleGenerator
 */
export function cacheAllProblems(problems: Problem[]): void {
  set('all-problems', problems);
  console.log(`📦 Cached ${problems.length} problems in RAM`);
}

/**
 * Get all problems from cache
 * Returns null if not cached or expired
 */
export function getCachedAllProblems(): Problem[] | null {
  return get<Problem[]>('all-problems');
}

/**
 * Cache all role scores
 * Used by: hotnessCalculator, companyContextAnalyzer
 */
export function cacheAllRoleScores(roleScores: ProblemRoleScore[]): void {
  set('all-role-scores', roleScores);
  console.log(`📦 Cached ${roleScores.length} role scores in RAM`);
}

/**
 * Get all role scores from cache
 * Returns null if not cached or expired
 */
export function getCachedAllRoleScores(): ProblemRoleScore[] | null {
  return get<ProblemRoleScore[]>('all-role-scores');
}

/**
 * Cache company data
 * Used by: hotnessCalculator, companyContextAnalyzer
 */
export function cacheCompany(companyId: string, company: Company): void {
  set(`company-${companyId}`, company);
}

/**
 * Get company from cache
 */
export function getCachedCompany(companyId: string): Company | null {
  return get<Company>(`company-${companyId}`);
}

/**
 * Cache company problems (from sub-collections)
 * Used by: hotnessCalculator for frequency/recency data
 */
export function cacheCompanyProblems(
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  problems: any
): void {
  set(`company-problems-${companyId}`, problems);
}

/**
 * Get company problems from cache
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCachedCompanyProblems(companyId: string): any | null {
  return get(`company-problems-${companyId}`);
}

/**
 * Clear all study plan caches
 * Use when debugging or to force fresh data
 */
export function clearStudyPlanCache(): void {
  clearAll();
  console.log('🗑️  Cleared study plan request cache');
}

/**
 * Export cache statistics
 * Useful for monitoring cache effectiveness
 */
export function getCacheStats() {
  return getStats();
}

/**
 * Periodic cache cleanup (removes expired entries)
 * Runs automatically every 10 minutes
 */
export function cleanupExpiredEntries(): void {
  const keysToDelete: string[] = [];

  for (const [key, entry] of cache.entries()) {
    if (isExpired(entry)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    cache.delete(key);
  }

  if (keysToDelete.length > 0) {
    console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}

// Auto-cleanup every 10 minutes (only in server environment)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 10 * 60 * 1000);
}
