import { NextRequest, NextResponse } from 'next/server';

// Define allowed API endpoints for external access
const allowedEndpoints = [
  '/api/companies/initialize',
  '/api/problem/prepare',
  '/api/execute-code',
  '/api/execute-code/status',
  '/api/execute-code/judge0-callback',
  '/api/debug/signature-failure',
];

// Define endpoints that are allowed for internal calls but should be blocked for external access
const internalOnlyEndpoints = [
  '/api/problem/filter',
  '/api/problem/transform',
  '/api/problem/import-batch',
  '/api/problem/by-difficulty',
  '/api/problem/blind75',
  '/api/companies/domain',
  '/api/problem',
  '/api/companies',
];

function isAllowedEndpoint(pathname: string, request: NextRequest): boolean {
  // For internal requests, allow internal-only endpoints
  if (isInternalRequest(request)) {
    return true;
  }
  
  // For external requests, only allow explicitly listed endpoints
  return allowedEndpoints.some(endpoint => {
    if (endpoint === '/api/execute-code/status') {
      // Allow any path that starts with /api/execute-code/status/
      return pathname.startsWith('/api/execute-code/status/');
    }
    // Exact match for all other endpoints
    return pathname === endpoint;
  });
}

function isInternalOnlyEndpoint(pathname: string): boolean {
  // Check exact matches first
  if (internalOnlyEndpoints.includes(pathname)) {
    return true;
  }
  
  // Check for dynamic routes
  // Block /api/problem/[id] (but allow /api/problem/prepare)
  if (pathname.startsWith('/api/problem/') && pathname !== '/api/problem/prepare') {
    return true;
  }
  
  // Block /api/companies/[id] (but allow /api/companies/initialize)
  if (pathname.startsWith('/api/companies/') && pathname !== '/api/companies/initialize') {
    return true;
  }
  
  return false;
}

function createCorsHeaders(origin: string | null) {
  // In production, restrict CORS to specific origins
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [
        process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com',
        // Add other allowed origins here
      ]
    : ['http://localhost:3000', 'http://localhost:3001']; // Development origins
  
  // Check if the origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Signature, X-Hp-Field, X-Client-Fingerprint, X-Requested-With, Accept, X-Debug-Client-Time, X-Debug-Request-Id, X-Debug-Client-Version, X-Debug-Payload-Keys, X-Debug-Payload-Size, X-Debug-Signature-Method, X-Debug-Browser, X-Debug-User-Agent, X-Debug-Session-Id, X-Debug-Endpoint',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function isInternalRequest(request: NextRequest): boolean {
  // Check if this is an internal server-side request
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // If there's no origin header, it's likely a server-side request
  if (!origin) {
    return true;
  }
  
  // If origin matches the host, it's an internal request
  if (host && origin.includes(host)) {
    return true;
  }
  
  // If referer is from the same host, it's internal
  if (host && referer && referer.includes(host)) {
    return true;
  }
  
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  
  // Handle all API routes
  if (pathname.startsWith('/api/')) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: createCorsHeaders(origin),
      });
    }

    // SECURITY CHECK 1: Block access to internal-only endpoints from external sources
    if (isInternalOnlyEndpoint(pathname) && !isInternalRequest(request)) {
      console.log(`[SECURITY] Blocked external access to internal-only endpoint: ${pathname}`);
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for internal use only.' },
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    // SECURITY CHECK 2: Only allow access to explicitly allowed endpoints
    if (!isAllowedEndpoint(pathname, request)) {
      console.log(`[SECURITY] Blocked access to non-allowed endpoint: ${pathname}`);
      return NextResponse.json(
        { error: 'Endpoint not found.' },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    // For allowed endpoints, continue with the request and add CORS headers
    const response = NextResponse.next();
    
    // Set CORS headers for allowed requests
    const corsHeaders = createCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }
  
  // For non-API routes, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*'
  ],
}; 