import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  message?: string;
}

interface RateLimiterResolvedConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  message: string;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private config: RateLimiterResolvedConfig;
  private cache: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    const {
      windowMs = 60_000,
      maxRequests = 10,
      skipSuccessfulRequests = false,
      message = 'Too many requests, please try again later',
      keyGenerator,
    } = config;

    this.config = {
      windowMs,
      maxRequests,
      skipSuccessfulRequests,
      message,
      keyGenerator,
    };

    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.windowMs);
    this.cleanupTimer.unref?.();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.resetTime < now) {
        this.cache.delete(key);
      }
    }
  }

  private getKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || 'unknown';
    }

    const realIp = req.headers.get('x-real-ip');
    return realIp || 'unknown';
  }

  async middleware(req: NextRequest): Promise<{ response: NextResponse | null; key: string }> {
    const key = this.getKey(req);
    const now = Date.now();
    let entry = this.cache.get(key);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs,
      };
      this.cache.set(key, entry);
      return { response: null, key };
    }

    if (entry.count >= this.config.maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      await this.logRateLimitViolation(key, req);

      const response = NextResponse.json(
        {
          error: this.config.message,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': this.config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
          },
        }
      );

      return { response, key };
    }

    entry.count += 1;
    return { response: null, key };
  }

  recordSuccessfulRequest(key: string): void {
    if (!this.config.skipSuccessfulRequests) {
      return;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return;
    }

    entry.count = Math.max(0, entry.count - 1);
    if (entry.count === 0) {
      this.cache.delete(key);
    }
  }

  private async logRateLimitViolation(key: string, req: NextRequest): Promise<void> {
    try {
      const db = adminDb();
      await db.collection('rate_limit_violations').add({
        key,
        endpoint: req.nextUrl?.pathname ?? req.url,
        timestamp: FieldValue.serverTimestamp(),
        headers: Object.fromEntries(req.headers.entries()),
      });
    } catch (error) {
      console.error('[RateLimiter] Failed to log rate limit violation:', error);
    }
  }
}

export const paymentRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
  message: 'Too many payment attempts. Please wait before trying again.',
});

export const subscriptionRateLimiter = new RateLimiter({
  windowMs: 300_000,
  maxRequests: 10,
});

export const webhookRateLimiter = new RateLimiter({
  windowMs: 1_000,
  maxRequests: 50,
  keyGenerator: () => 'razorpay-webhook',
  skipSuccessfulRequests: true,
});

type ApiHandler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

export function withRateLimit(limiter: RateLimiter) {
  return (handler: ApiHandler): ApiHandler => {
    return async (req: NextRequest) => {
      const { response, key } = await limiter.middleware(req);
      if (response) {
        return response;
      }

      const result = await handler(req);

      if (result.ok) {
        limiter.recordSuccessfulRequest(key);
      }

      return result;
    };
  };
}

export { RateLimiter };
