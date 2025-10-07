/**
 * Cache Manager
 *
 * Manages Firestore cache operations for study plans.
 * Implements fire-and-forget caching strategy:
 * 1. Check if study plan exists in cache
 * 2. Return immediately (cached or freshly generated)
 * 3. Asynchronously save to cache (if new)
 *
 * **Cache Strategy:**
 * - Cache Key: `${companyId}_${roleFamily}_${timeline}_${hoursPerDay}_${filters}`
 * - TTL: 7 days (study plans don't change frequently)
 * - Storage: Firestore collection `studyPlanCache`
 * - Background updates: No blocking on writes
 *
 * **Why Firestore Cache:**
 * - Study plans are expensive to generate (1-2 seconds)
 * - Multiple users request same plans (Meta + Backend + 14 days + 2 hrs)
 * - Plans remain valid for days (problem frequencies update weekly)
 * - Request-level RAM cache expires in 5 minutes
 * - Firestore cache persists across server restarts
 */

import { adminDb } from '../firebase/firebaseAdmin';
import { StudyPlanRequest, StudyPlanResponse } from '@/data-types/studyPlan';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Cache document structure in Firestore
 */
interface CachedStudyPlan {
  // Cache metadata
  cacheKey: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  hitCount: number; // Track cache effectiveness

  // Cached response
  response: StudyPlanResponse;
}

/**
 * Default cache TTL: 7 days
 * Study plans remain valid for a week since:
 * - Problem frequencies update weekly
 * - Company data rarely changes
 * - Role scores are pre-computed and static
 */
const CACHE_TTL_DAYS = 7;

/**
 * Generate cache key from study plan request
 * Format: companyId_role_timeline_hours_filters
 */
function generateCacheKey(request: StudyPlanRequest): string {
  const parts = [
    request.companyId,
    request.roleFamily,
    `${request.timeline}d`,
    `${request.hoursPerDay}h`
  ];

  // Add difficulty filter if present and not all-inclusive
  if (request.difficultyPreference) {
    const { easy, medium, hard } = request.difficultyPreference;
    const diff = [];
    if (easy) diff.push('e');
    if (medium) diff.push('m');
    if (hard) diff.push('h');
    // Only add to cache key if it's a filter (not all three or none)
    if (diff.length > 0 && diff.length < 3) {
      parts.push(`diff-${diff.join('')}`);
    }
  }

  // Add topic focus if present
  if (request.topicFocus && request.topicFocus.length > 0) {
    const topics = request.topicFocus.sort().join('-');
    parts.push(`topics-${topics}`);
  }

  return parts.join('_');
}

/**
 * Check if cached study plan exists and is valid
 *
 * @returns Cached plan if exists and not expired, null otherwise
 */
export async function getCachedStudyPlan(
  request: StudyPlanRequest
): Promise<StudyPlanResponse | null> {
  const cacheKey = generateCacheKey(request);

  try {
    const db = adminDb();
    const cacheRef = db.collection('studyPlanCache').doc(cacheKey);
    const doc = await cacheRef.get();

    if (!doc.exists) {
      console.log(`💨 Cache miss: ${cacheKey}`);
      return null;
    }

    const cached = doc.data() as CachedStudyPlan;

    // Check if expired
    const now = Timestamp.now();
    if (cached.expiresAt.toMillis() < now.toMillis()) {
      console.log(`⏰ Cache expired: ${cacheKey}`);
      // Delete expired cache entry (fire-and-forget)
      cacheRef.delete().catch(err => console.error('Failed to delete expired cache:', err));
      return null;
    }

    // Cache hit - increment hit counter (fire-and-forget)
    cacheRef
      .update({ hitCount: (cached.hitCount || 0) + 1 })
      .catch(err => console.error('Failed to update hit count:', err));

    console.log(`✅ Cache hit: ${cacheKey} (hits: ${cached.hitCount || 0})`);
    return cached.response;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null; // On error, treat as cache miss
  }
}

/**
 * Save study plan to cache (fire-and-forget)
 *
 * This function returns immediately and saves asynchronously.
 * Errors are logged but don't block the response.
 */
export function cacheStudyPlan(
  request: StudyPlanRequest,
  response: StudyPlanResponse
): void {
  const cacheKey = generateCacheKey(request);

  // Fire-and-forget: Don't await this Promise
  saveToCacheAsync(cacheKey, request, response).catch(err => {
    console.error('Failed to save study plan to cache:', err);
  });

  console.log(`📦 Queued cache save: ${cacheKey}`);
}

/**
 * Async function to save to cache
 * Called by cacheStudyPlan but not awaited
 */
async function saveToCacheAsync(
  cacheKey: string,
  request: StudyPlanRequest,
  response: StudyPlanResponse
): Promise<void> {
  const db = adminDb();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    now.toMillis() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  const cacheDoc: CachedStudyPlan = {
    cacheKey,
    createdAt: now,
    expiresAt,
    hitCount: 0,
    response
  };

  await db.collection('studyPlanCache').doc(cacheKey).set(cacheDoc);
  console.log(`💾 Cached study plan: ${cacheKey}`);
}

/**
 * Clear expired cache entries
 * Run this periodically (e.g., daily cron job) to free up storage
 */
export async function clearExpiredCache(): Promise<number> {
  const db = adminDb();
  const now = Timestamp.now();

  const snapshot = await db
    .collection('studyPlanCache')
    .where('expiresAt', '<', now)
    .get();

  if (snapshot.empty) {
    console.log('No expired cache entries found');
    return 0;
  }

  // Delete in batches (Firestore limit: 500 writes per batch)
  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;

    // Commit batch every 500 deletes
    if (count % 500 === 0) {
      await batch.commit();
    }
  }

  // Commit remaining deletes
  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`🗑️  Deleted ${count} expired cache entries`);
  return count;
}

/**
 * Clear all cache entries for a specific company
 * Use when company data is updated
 */
export async function clearCompanyCache(companyId: string): Promise<number> {
  const db = adminDb();

  const snapshot = await db
    .collection('studyPlanCache')
    .where('request.companyId', '==', companyId)
    .get();

  if (snapshot.empty) {
    console.log(`No cache entries found for company: ${companyId}`);
    return 0;
  }

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`🗑️  Deleted ${count} cache entries for company: ${companyId}`);
  return count;
}

/**
 * Get cache statistics
 * Useful for monitoring cache effectiveness
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  avgHitsPerEntry: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  const db = adminDb();
  const snapshot = await db.collection('studyPlanCache').get();

  if (snapshot.empty) {
    return {
      totalEntries: 0,
      totalHits: 0,
      avgHitsPerEntry: 0,
      oldestEntry: null,
      newestEntry: null
    };
  }

  let totalHits = 0;
  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as CachedStudyPlan;
    totalHits += data.hitCount || 0;

    const created = data.createdAt.toMillis();
    if (created < oldestTimestamp) {
      oldestTimestamp = created;
    }
    if (created > newestTimestamp) {
      newestTimestamp = created;
    }
  }

  return {
    totalEntries: snapshot.size,
    totalHits,
    avgHitsPerEntry: totalHits / snapshot.size,
    oldestEntry: new Date(oldestTimestamp),
    newestEntry: new Date(newestTimestamp)
  };
}
