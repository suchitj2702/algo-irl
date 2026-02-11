import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@algo-irl/lib/security/cors';

/**
 * Diagnostic endpoint to help debug CORS and header issues
 * Particularly useful for corporate networks that modify headers
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Collect all headers for debugging
  const allHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Mask sensitive headers partially for security
    if (key.toLowerCase() === 'authorization') {
      allHeaders[key] = value.substring(0, 20) + '...';
    } else if (key.toLowerCase() === 'cookie') {
      allHeaders[key] = '[REDACTED]';
    } else {
      allHeaders[key] = value;
    }
  });

  // Extract useful debugging information
  const debugInfo = {
    timestamp: new Date().toISOString(),
    headers: allHeaders,
    origin: origin || 'NOT_PROVIDED',
    referer: referer || 'NOT_PROVIDED',
    userAgent: request.headers.get('user-agent') || 'NOT_PROVIDED',

    // IP detection
    ipInfo: {
      xRealIp: request.headers.get('x-real-ip') || 'NOT_PROVIDED',
      xForwardedFor: request.headers.get('x-forwarded-for') || 'NOT_PROVIDED',
      cfConnectingIp: request.headers.get('cf-connecting-ip') || 'NOT_PROVIDED',
    },

    // Corporate proxy indicators
    proxyIndicators: {
      hasViaHeader: !!request.headers.get('via'),
      hasXForwardedHost: !!request.headers.get('x-forwarded-host'),
      hasXForwardedProto: !!request.headers.get('x-forwarded-proto'),
      hasProxyAuthorization: !!request.headers.get('proxy-authorization'),
      originIsNull: origin === 'null',
      originMissing: !origin,
    },

    // CORS analysis
    corsAnalysis: {
      wouldPassCors: false,
      reason: '',
      suggestedFix: '',
    },

    // Request details
    method: request.method,
    url: request.url,
    pathname: request.nextUrl.pathname,
  };

  // Analyze CORS situation
  const corsHeaders = getCorsHeaders(origin, request);
  const corsHeadersObj = corsHeaders as Record<string, string>;
  const allowOriginHeader = corsHeadersObj['Access-Control-Allow-Origin'];

  if (allowOriginHeader) {
    debugInfo.corsAnalysis.wouldPassCors = true;
    debugInfo.corsAnalysis.reason = `Origin '${origin}' is allowed`;
  } else if (!origin || origin === 'null') {
    debugInfo.corsAnalysis.wouldPassCors = false;
    debugInfo.corsAnalysis.reason = 'Origin header is missing or null (likely stripped by corporate proxy)';
    debugInfo.corsAnalysis.suggestedFix = 'Corporate IT should configure proxy to preserve Origin header, or use VPN bypass for this domain';
  } else {
    debugInfo.corsAnalysis.wouldPassCors = false;
    debugInfo.corsAnalysis.reason = `Origin '${origin}' is not in the allowed list`;
    debugInfo.corsAnalysis.suggestedFix = 'Contact support to add this origin to the allowed list';
  }

  // Add recommendation based on proxy indicators
  const proxyDetected = Object.values(debugInfo.proxyIndicators).some(v => v === true);
  if (proxyDetected) {
    debugInfo.corsAnalysis.suggestedFix +=
      '\n\nProxy detected: Your corporate network appears to be modifying requests. ' +
      'Try: 1) Using VPN bypass for *.algoirl.ai and *.vercel.app, ' +
      '2) Accessing from personal device/network, or ' +
      '3) Asking IT to preserve Origin headers for these domains.';
  }

  return NextResponse.json(debugInfo, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Debug-Endpoint': 'true',
    },
  });
}
