import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestSignature } from './request-signing';

/**
 * Simplified Enhanced Security Middleware
 *
 * This module provides signature verification for API endpoints.
 * Other security features are now handled by Vercel:
 * - Rate limiting → Vercel Firewall
 * - Bot detection → Vercel Bot Protection
 * - Abuse prevention → Vercel Firewall
 * - DDoS protection → Vercel (automatic)
 */

export async function enhancedSecurityMiddleware(
  request: NextRequest,
  handler: (request: NextRequest, parsedBody?: Record<string, unknown>) => Promise<NextResponse>,
  options: {
    requireSignature?: boolean;
  } = {}
): Promise<NextResponse> {
  try {
    // 1. Request body validation for POST requests
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
    }

    // 2. Request signature verification (for both GET and POST) - only in production
    if (options.requireSignature && process.env.NODE_ENV === 'production') {
      const timestamp = parseInt(request.headers.get('x-timestamp') || '0');
      const signature = request.headers.get('x-signature') || '';
      const nonce = request.headers.get('x-request-id') || '';

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

      // Verify signature (async with nonce check)
      const isValidSignature = await verifyRequestSignature(
        payloadToVerify,
        timestamp,
        signature,
        nonce,
        5 * 60 * 1000,
        debugHeaders
      );

      if (!isValidSignature) {
        console.warn('[SECURITY] Invalid signature detected:', {
          url: request.url,
          method: request.method,
          timestamp,
          hasNonce: !!nonce
        });

        return NextResponse.json(
          { error: 'Invalid request signature' },
          { status: 401 }
        );
      }
    }

    // Execute the main handler after all security checks pass
    const response = await handler(request, requestBody || undefined);

    return response;

  } catch (error) {
    console.error('Enhanced security middleware error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
