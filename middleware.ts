import { NextRequest, NextResponse } from 'next/server';

// Define allowed API endpoints
const allowedEndpoints = [
  '/api/companies/initialize',
  '/api/problem/prepare',
  '/api/execute-code',
  '/api/execute-code/status'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the request is for an allowed API endpoint
  const isAllowedEndpoint = allowedEndpoints.some(endpoint => {
    if (endpoint === '/api/execute-code/status') {
      // Allow any path that starts with /api/execute-code/status/
      return pathname.startsWith('/api/execute-code/status/');
    }
    return pathname === endpoint;
  });
  
  // Block access to non-allowed API endpoints
  if (pathname.startsWith('/api/') && !isAllowedEndpoint) {
    return new NextResponse(
      JSON.stringify({ error: 'API endpoint not available' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // Only apply CORS to allowed API endpoints
  if (isAllowedEndpoint) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Continue with the request and add CORS headers
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return response;
  }
  
  // For non-API routes, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/companies/initialize',
    '/api/problem/prepare', 
    '/api/execute-code',
    '/api/execute-code/status/:path*',
    '/api/:path*' // This catches all API routes for blocking
  ],
}; 