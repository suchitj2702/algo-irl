import { Problem } from '@/data-types/problem';
import { ProblemRoleScore } from './types';
import { Company } from '@/data-types/company';
import { RequestCache } from '@/lib/shared/requestCache';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 60 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new RequestCache<any>({
  ttlMs: DEFAULT_TTL_MS,
  periodicCleanupMs: 10 * 60 * 1000, // cleanup every 10 minutes
});

export function cacheAllProblems(problems: Problem[]): void {
  cache.set('all-problems', problems);
  console.log(`📦 Cached ${problems.length} problems in RAM`);
}

export function getCachedAllProblems(): Problem[] | null {
  return cache.get('all-problems');
}

export function cacheAllRoleScores(roleScores: ProblemRoleScore[]): void {
  cache.set('all-role-scores', roleScores);
  console.log(`📦 Cached ${roleScores.length} role scores in RAM`);
}

export function getCachedAllRoleScores(): ProblemRoleScore[] | null {
  return cache.get('all-role-scores');
}

export function cacheCompany(companyId: string, company: Company): void {
  cache.set(`company-${companyId}`, company);
}

export function getCachedCompany(companyId: string): Company | null {
  return cache.get(`company-${companyId}`);
}

export function cacheCompanyProblems(
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  problems: any
): void {
  cache.set(`company-problems-${companyId}`, problems);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCachedCompanyProblems(companyId: string): any | null {
  return cache.get(`company-problems-${companyId}`);
}

export function clearStudyPlanCache(): void {
  cache.clear();
  console.log('🗑️  Cleared study plan request cache');
}

export function getCacheStats() {
  const stats = cache.getStats();
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
    totalEntries: stats.size,
    entriesByKey,
    oldestEntry: stats.size > 0 ? oldestTimestamp : null
  };
}

export function cleanupExpiredEntries(): void {
  const removed = cache.cleanupExpired();
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} expired cache entries`);
  }
}
