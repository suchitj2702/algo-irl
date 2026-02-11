interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface RequestCacheOptions {
  maxSize?: number;
  ttlMs: number;
  lru?: boolean;
  periodicCleanupMs?: number;
}

export class RequestCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttlMs: number;
  private lru: boolean;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: RequestCacheOptions) {
    this.maxSize = options.maxSize ?? Infinity;
    this.ttlMs = options.ttlMs;
    this.lru = options.lru ?? false;

    if (options.periodicCleanupMs && typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanupExpired(), options.periodicCleanupMs);
    }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    if (this.lru) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return { size: this.cache.size, maxSize: this.maxSize, ttlMs: this.ttlMs };
  }

  cleanupExpired(): number {
    const keysToDelete: string[] = [];
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    return keysToDelete.length;
  }

  entries(): IterableIterator<[string, CacheEntry<T>]> {
    return this.cache.entries();
  }

  destroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cache.clear();
  }
}
