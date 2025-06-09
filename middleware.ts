import { NextRequest, NextResponse } from 'next/server';

// Define allowed API endpoints for external access
const allowedEndpoints = [
  '/api/companies/initialize',
  '/api/problem/prepare',
  '/api/execute-code',
  '/api/execute-code/status',
  // allow these for internal calls from /api/problem/prepare
  '/api/problem/filter',
  '/api/problem/transform',
];

// Define endpoints that are allowed for internal calls but should be blocked for external access
const internalOnlyEndpoints = [
  '/api/problem/filter',
  '/api/problem/transform'
];

function isAllowedEndpoint(pathname: string): boolean {
  return allowedEndpoints.some(endpoint => {
    if (endpoint === '/api/execute-code/status') {
      // Allow any path that starts with /api/execute-code/status/
      return pathname.startsWith('/api/execute-code/status/');
    }
    if (endpoint === '/api/problem/filter' || endpoint === '/api/problem/transform') {
      return pathname === endpoint;
    }
    // For dynamic routes like /api/problem/[id]
    if (pathname.startsWith('/api/problem/') && pathname !== '/api/problem/prepare' && pathname !== '/api/problem/filter' && pathname !== '/api/problem/transform') {
      return true; // Allow /api/problem/[id] for internal calls
    }
    return pathname === endpoint;
  });
}

function isInternalOnlyEndpoint(pathname: string): boolean {
  return internalOnlyEndpoints.includes(pathname) || 
         (pathname.startsWith('/api/problem/') && pathname !== '/api/problem/prepare');
}

function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Signature, X-Hp-Field, X-Client-Fingerprint, X-Requested-With, Accept',
    'Access-Control-Max-Age': '86400',
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
  
  // Handle all API routes - allow all endpoints for testing CORS
  if (pathname.startsWith('/api/')) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: createCorsHeaders(),
      });
    }

    // For all API endpoints, continue with the request and add CORS headers
    const response = NextResponse.next();
    
    // Set CORS headers
    const corsHeaders = createCorsHeaders();
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