import { Problem } from '@/data-types/problem';
import type { Company } from '@/data-types/company';
import { RequestCache } from '@/lib/shared/requestCache';

const problemCache = new RequestCache<Problem>({ maxSize: 100, ttlMs: 10_000, lru: true });
const companyCache = new RequestCache<Company>({ maxSize: 50, ttlMs: 10_000, lru: true });

export function getCachedProblem(problemId: string): Problem | null {
  return problemCache.get(problemId);
}

export function cacheProblem(problemId: string, problem: Problem): void {
  problemCache.set(problemId, problem);
}

export function getCachedCompany(companyId: string): Company | null {
  return companyCache.get(companyId);
}

export function cacheCompany(companyId: string, company: Company): void {
  companyCache.set(companyId, company);
}

export function clearAllCaches(): void {
  problemCache.clear();
  companyCache.clear();
}

export function getCacheStats() {
  return {
    problems: problemCache.getStats(),
    companies: companyCache.getStats()
  };
}
