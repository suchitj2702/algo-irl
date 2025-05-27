import { NextRequest, NextResponse } from 'next/server';

// Define allowed API endpoints
const allowedEndpoints = [
  '/api/companies/initialize',
  '/api/problem/prepare',
  '/api/execute-code',
  '/api/execute-code/status'
];

function isAllowedEndpoint(pathname: string): boolean {
  return allowedEndpoints.some(endpoint => {
    if (endpoint === '/api/execute-code/status') {
      // Allow any path that starts with /api/execute-code/status/
      return pathname.startsWith('/api/execute-code/status/');
    }
    return pathname === endpoint;
  });
}

function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Handle all API routes
  if (pathname.startsWith('/api/')) {
    const isAllowed = isAllowedEndpoint(pathname);
    
    // Block access to non-allowed API endpoints
    if (!isAllowed) {
      return new NextResponse(
        JSON.stringify({ error: 'API endpoint not available' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...createCorsHeaders(), // Add CORS headers even for blocked endpoints
          },
        }
      );
    }
    
    // Handle CORS preflight requests for allowed endpoints
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: createCorsHeaders(),
      });
    }

    // For allowed endpoints, continue with the request and add CORS headers
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