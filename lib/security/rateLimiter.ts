import { LRUCache } from 'lru-cache';

// Rate limiter using in-memory cache (consider Redis for production)
export class RateLimiter {
  private cache: LRUCache<string, number[]>;
  public readonly maxRequests: number;
  
  constructor(
    maxRequests: number,
    private windowMs: number,
    private maxCacheSize: number = 10000
  ) {
    this.maxRequests = maxRequests;
    this.cache = new LRUCache({
      max: maxCacheSize,
      ttl: windowMs,
    });
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get existing requests for this identifier
    let requests = this.cache.get(identifier) || [];
    
    // Filter out old requests
    requests = requests.filter((timestamp: number) => timestamp > windowStart);
    
    // Check if limit exceeded
    if (requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...requests);
      const resetAt = oldestRequest + this.windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }
    
    // Add current request
    requests.push(now);
    this.cache.set(identifier, requests);
    
    return {
      allowed: true,
      remaining: this.maxRequests - requests.length,
      resetAt: now + this.windowMs
    };
  }
} 