import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from './rateLimiter';
import { generateFingerprint } from './fingerprint';

// Different rate limiters for different endpoints
const rateLimiters = {
  codeExecution: new RateLimiter(10, 60 * 1000), // 10 requests per minute
  problemGeneration: new RateLimiter(30, 60 * 1000), // 30 requests per minute
  companyCreation: new RateLimiter(20, 60 * 60 * 1000), // 20 per hour
  general: new RateLimiter(100, 60 * 1000), // 100 requests per minute
};

export async function withRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
  limiterType: keyof typeof rateLimiters = 'general'
): Promise<NextResponse> {
  const fingerprint = generateFingerprint(request);
  const rateLimiter = rateLimiters[limiterType];
  
  const { allowed, remaining, resetAt } = await rateLimiter.checkLimit(fingerprint);
  
  if (!allowed) {
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        resetAt: new Date(resetAt).toISOString()
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimiter.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetAt),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000))
        }
      }
    );
  }
  
  // Execute the handler
  const response = await handler(request);
  
  // Add rate limit headers to response
  response.headers.set('X-RateLimit-Limit', String(rateLimiter.maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(resetAt));
  
  return response;
} 