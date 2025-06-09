import { NextRequest, NextResponse } from 'next/server';
import { AbusePreventionService } from './abuse-prevention';
import { SecurityMonitor } from './monitoring';
import { generateFingerprint } from './fingerprint';
import { checkHoneypot } from './honeypot';
import { verifyRequestSignature } from './request-signing';
import { RateLimiter } from './rateLimiter';

// Global instances
const abuseService = new AbusePreventionService();
const securityMonitor = new SecurityMonitor();

// Different rate limiters for different endpoints
const rateLimiters = {
  codeExecution: new RateLimiter(10, 60 * 1000), // 10 requests per minute
  problemGeneration: new RateLimiter(30, 60 * 1000), // 30 requests per minute
  companyCreation: new RateLimiter(5, 60 * 60 * 1000), // 5 per hour
  general: new RateLimiter(100, 60 * 1000), // 100 requests per minute
};

// Function to reset rate limiters for testing
export function resetRateLimiters() {
  rateLimiters.codeExecution = new RateLimiter(10, 60 * 1000);
  rateLimiters.problemGeneration = new RateLimiter(30, 60 * 1000);
  rateLimiters.companyCreation = new RateLimiter(5, 60 * 60 * 1000);
  rateLimiters.general = new RateLimiter(100, 60 * 1000);
}

export async function enhancedSecurityMiddleware(
  request: NextRequest,
  handler: (request: NextRequest, parsedBody?: Record<string, unknown>) => Promise<NextResponse>,
  options: {
    rateLimiterType?: keyof typeof rateLimiters;
    requireSignature?: boolean;
    checkHoneypotField?: boolean;
  } = {}
): Promise<NextResponse> {
  const fingerprint = generateFingerprint(request);
  
  try {
    // 1. Rate limiting check
    const rateLimiter = rateLimiters[options.rateLimiterType || 'general'];
    const { allowed: rateLimitAllowed, remaining, resetAt } = await rateLimiter.checkLimit(fingerprint);
    
    if (!rateLimitAllowed) {
      securityMonitor.logEvent({
        type: 'rate_limit',
        fingerprint,
        details: { url: request.url, rateLimiterType: options.rateLimiterType }
      });
      
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

    // 2. Abuse tracking check
    const activityType = getActivityType(request.url);
    const { allowed: abuseAllowed, reason } = await abuseService.trackActivity(fingerprint, activityType);
    
    if (!abuseAllowed) {
      securityMonitor.logEvent({
        type: 'abuse_pattern',
        fingerprint,
        details: { reason, url: request.url, activityType }
      });
      
      return NextResponse.json(
        { error: reason },
        { status: 403 }
      );
    }

    // 3. Request body validation for POST requests
    let requestBody: Record<string, unknown> | null = null;
    if (request.method === 'POST') {
      try {
        requestBody = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }

      // 4. Honeypot check
      if (options.checkHoneypotField) {
        const honeypotField = request.headers.get('x-hp-field');
        
        if (honeypotField && requestBody && !checkHoneypot(requestBody, honeypotField)) {
          abuseService.reportSuspiciousActivity(fingerprint, 'Honeypot triggered');
          securityMonitor.logEvent({
            type: 'honeypot_triggered',
            fingerprint,
            details: { url: request.url, honeypotField }
          });
          
          // Return success to confuse bots
          return NextResponse.json({ success: true });
        }
      }

      // 5. Request signature verification
      if (options.requireSignature) {
        const timestamp = parseInt(request.headers.get('x-timestamp') || '0');
        const signature = request.headers.get('x-signature') || '';
        
        if (!requestBody || !verifyRequestSignature(requestBody, timestamp, signature)) {
          securityMonitor.logEvent({
            type: 'invalid_signature',
            fingerprint,
            details: { url: request.url }
          });
          
          return NextResponse.json(
            { error: 'Invalid request signature' },
            { status: 401 }
          );
        }
      }
    }

    // Execute the main handler
    const response = await handler(request, requestBody || undefined);
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', String(rateLimiter.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(resetAt));
    
    return response;
    
  } catch (error) {
    console.error('Enhanced security middleware error:', error);
    
    // Log security middleware errors
    securityMonitor.logEvent({
      type: 'rate_limit', // Using existing type for middleware errors
      fingerprint,
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        url: request.url,
        middleware: 'enhanced-security'
      }
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getActivityType(url: string): 'codeExecutions' | 'companyCreations' | 'problemGenerations' {
  if (url.includes('/execute-code')) return 'codeExecutions';
  if (url.includes('/companies')) return 'companyCreations';
  return 'problemGenerations';
}

// Export service instances for direct access if needed
export { abuseService, securityMonitor }; 