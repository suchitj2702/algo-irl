import { NextRequest, NextResponse } from 'next/server';
import { AbusePreventionService } from './abuse-prevention';
import { SecurityMonitor } from './monitoring';
import { generateFingerprint } from './fingerprint';
import { checkHoneypot } from './honeypot';
import { verifyRequestSignature } from './request-signing';
import { RateLimiter } from './rateLimiter';

/**
 * Enhanced Security Middleware System
 * 
 * This module implements a comprehensive multi-layered security system for API endpoints.
 * It provides protection against various attack vectors including:
 * - Rate limiting and abuse prevention
 * - Request fingerprinting and tracking
 * - Honeypot bot detection
 * - Request signature verification
 * - Security event monitoring and logging
 * 
 * Security Layers:
 * 1. Rate limiting based on request fingerprints
 * 2. Abuse pattern detection and prevention
 * 3. Request body validation and honeypot checks
 * 4. Optional cryptographic signature verification
 * 5. Comprehensive security event logging
 */

// Global security service instances
const abuseService = new AbusePreventionService();
const securityMonitor = new SecurityMonitor();

/**
 * Configured rate limiters for different endpoint types.
 * Each endpoint type has different limits based on expected usage patterns.
 * Values are read from environment variables with fallback defaults.
 */
const rateLimiters = {
  codeExecution: new RateLimiter(
    parseInt(process.env.RATE_LIMIT_CODE_EXECUTION_REQUESTS || '10'),
    parseInt(process.env.RATE_LIMIT_CODE_EXECUTION_WINDOW || '60000')
  ),
  problemGeneration: new RateLimiter(
    parseInt(process.env.RATE_LIMIT_PROBLEM_GENERATION_REQUESTS || '30'),
    parseInt(process.env.RATE_LIMIT_PROBLEM_GENERATION_WINDOW || '60000')
  ),
  companyCreation: new RateLimiter(
    parseInt(process.env.RATE_LIMIT_COMPANY_CREATION_REQUESTS || '5'),
    parseInt(process.env.RATE_LIMIT_COMPANY_CREATION_WINDOW || '3600000')
  ),
  general: new RateLimiter(
    parseInt(process.env.RATE_LIMIT_GENERAL_REQUESTS || '100'),
    parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW || '60000')
  ),
};

/**
 * Resets all rate limiters to their initial state.
 * This function is primarily used for testing purposes to ensure
 * clean state between test runs.
 */
export function resetRateLimiters() {
  rateLimiters.codeExecution = new RateLimiter(
    parseInt(process.env.RATE_LIMIT_CODE_EXECUTION_REQUESTS || '10'),
    parseInt(process.env.RATE_LIMIT_CODE_EXECUTION_WINDOW || '60000')
  );
  rateLimiters.problemGeneration = new RateLimiter(
    parseInt(process.env.RATE_LIMIT_PROBLEM_GENERATION_REQUESTS || '30'),
    parseInt(process.env.RATE_LIMIT_PROBLEM_GENERATION_WINDOW || '60000')
  );
  rateLimiters.companyCreation = new RateLimiter(
    parseInt(process.env.RATE_LIMIT_COMPANY_CREATION_REQUESTS || '5'),
    parseInt(process.env.RATE_LIMIT_COMPANY_CREATION_WINDOW || '3600000')
  );
  rateLimiters.general = new RateLimiter(
    parseInt(process.env.RATE_LIMIT_GENERAL_REQUESTS || '100'),
    parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW || '60000')
  );
}

/**
 * Enhanced security middleware that provides comprehensive protection for API endpoints.
 * This middleware implements a multi-layered security approach with configurable options.
 * 
 * Security Process:
 * 1. Generate unique fingerprint for request tracking
 * 2. Apply rate limiting based on endpoint type
 * 3. Check for abuse patterns and suspicious behavior
 * 4. Validate request body structure for POST requests
 * 5. Perform honeypot checks to detect automated bots
 * 6. Verify cryptographic signatures if required
 * 7. Execute the main request handler
 * 8. Add security headers to response
 * 9. Log all security events for monitoring
 * 
 * @param request - The incoming Next.js request object
 * @param handler - The main request handler function to execute after security checks
 * @param options - Configuration options for security middleware
 * @param options.rateLimiterType - Type of rate limiter to apply (default: 'general')
 * @param options.requireSignature - Whether to require cryptographic signature verification
 * @param options.checkHoneypotField - Whether to perform honeypot bot detection
 * @returns Promise resolving to NextResponse with security headers
 */
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
    }

    // 5. Request signature verification (for both GET and POST)
    if (options.requireSignature) {
      const timestamp = parseInt(request.headers.get('x-timestamp') || '0');
      const signature = request.headers.get('x-signature') || '';
      
      // Collect debug headers for troubleshooting
      const debugHeaders: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        if (key.startsWith('x-debug-')) {
          debugHeaders[key] = value;
        }
      });
      
      // For GET requests, use query parameters as the payload
      // For POST requests, use the request body
      const payloadToVerify = request.method === 'GET' 
        ? Object.fromEntries(new URL(request.url).searchParams.entries())
        : requestBody || {};
      
      if (!verifyRequestSignature(payloadToVerify, timestamp, signature, 5 * 60 * 1000, debugHeaders)) {
        securityMonitor.logEvent({
          type: 'invalid_signature',
          fingerprint,
          details: { url: request.url, method: request.method }
        });
        
        return NextResponse.json(
          { error: 'Invalid request signature' },
          { status: 401 }
        );
      }
    }

    // Execute the main handler after all security checks pass
    const response = await handler(request, requestBody || undefined);
    
    // Add rate limit headers to successful responses for client awareness
    response.headers.set('X-RateLimit-Limit', String(rateLimiter.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(resetAt));
    
    return response;
    
  } catch (error) {
    console.error('Enhanced security middleware error:', error);
    
    // Log security middleware errors for monitoring
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

/**
 * Determines the activity type based on request URL patterns.
 * This function maps URL patterns to specific activity types for abuse tracking.
 * 
 * @param url - The request URL to analyze
 * @returns Activity type for abuse prevention tracking
 */
function getActivityType(url: string): 'codeExecutions' | 'companyCreations' | 'problemGenerations' {
  if (url.includes('/execute-code')) return 'codeExecutions';
  if (url.includes('/companies')) return 'companyCreations';
  return 'problemGenerations';
}

// Export service instances for direct access if needed
export { abuseService, securityMonitor }; 