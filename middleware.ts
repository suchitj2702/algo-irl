import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyFirebaseToken } from '@algo-irl/lib/auth/verifyFirebaseTokenEdge';

interface EndpointRule {
  path: string;
  description: string;
  match?: 'exact' | 'prefix';
  requiresAuth?: boolean;
}

/**
 * Allowed external API endpoints.
 * `requiresAuth` marks routes that must present a valid Firebase ID token.
 */
const allowedEndpoints: EndpointRule[] = [
  {
    path: '/api/problem/prepare',
    description: 'Public problem preparation endpoint.',
  },
  {
    path: '/api/execute-code',
    description: 'Public code execution endpoint.',
  },
  {
    path: '/api/execute-code/status',
    match: 'prefix',
    description: 'Job status polling for code execution.',
  },
  {
    path: '/api/execute-code/judge0-callback',
    description: 'Judge0 callback endpoint (signature verified via Judge0).',
  },
  {
    path: '/api/companies',
    description: 'Public company catalogue.',
  },
  {
    path: '/api/study-plan/generate',
    description: 'Public study plan generation endpoint.',
  },
  {
    path: '/api/user',
    match: 'prefix',
    requiresAuth: true,
    description: 'Authenticated user routes (Firebase ID token required).',
  },
  {
    path: '/api/billing',
    match: 'prefix',
    requiresAuth: true,
    description: 'Authenticated billing routes (Firebase ID token required).',
  },
  {
    path: '/api/razorpay/webhook',
    description: 'Razorpay webhook endpoint (signature verified).',
  },
];

// Define endpoints that are allowed for internal calls but should be blocked for external access
const internalOnlyEndpoints = [
  '/api/problem/filter',
  '/api/problem/transform',
  '/api/problem/by-difficulty',
  '/api/problem/blind75',
  '/api/companies/initialize',
  '/api/problem',
];

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

  // Block all /api/companies/* routes (all are internal-only)
  if (pathname.startsWith('/api/companies/')) {
    return true;
  }

  return false;
}

function matchesEndpoint(pathname: string, rule: EndpointRule): boolean {
  if (rule.match === 'prefix') {
    return pathname === rule.path || pathname.startsWith(`${rule.path}/`);
  }

  return pathname === rule.path;
}

function findAllowedEndpoint(pathname: string): EndpointRule | undefined {
  return allowedEndpoints.find((endpoint) => matchesEndpoint(pathname, endpoint));
}

function requiresAuthForEndpoint(pathname: string): boolean {
  return allowedEndpoints.some((endpoint) => endpoint.requiresAuth && matchesEndpoint(pathname, endpoint));
}

function createCorsHeaders(origin: string | null) {
  // In production, restrict CORS to specific origins
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com',
        // Add other allowed origins here
      ]
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']; // Development origins
  
  // Check if the origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const corsHeaders = createCorsHeaders(origin);

  // Handle all API routes
  if (pathname.startsWith('/api/')) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Get IP from Vercel headers for tracking
    const ip = request.headers.get('x-real-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    const internalRequest = isInternalRequest(request);
    const allowedEndpoint = findAllowedEndpoint(pathname);

    // Check if IP is manually blocked (via Vercel KV) - only in production
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const blockedUntil = await kv.get<number>(`blocked:${ip}`);
        if (blockedUntil && blockedUntil > Date.now()) {
          console.log(`[SECURITY][ACCESS] Blocked IP attempted access: ${ip} on ${pathname}`);
          return NextResponse.json(
            { error: 'Access denied' },
            {
              status: 403,
              headers: {
                'Content-Type': 'application/json',
              }
            }
          );
        }
      } catch (error) {
        console.error('[SECURITY][KV] Error checking blocked IPs from KV:', error);
        // Continue processing request if KV check fails
      }
    }

    // SECURITY CHECK 1: Block access to internal-only endpoints from external sources
    if (isInternalOnlyEndpoint(pathname) && !internalRequest) {
      console.log(`[SECURITY][ACCESS] Blocked external access to internal-only endpoint: ${pathname}`);
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
    if (!internalRequest && !allowedEndpoint) {
      console.log(`[SECURITY][ACCESS] Blocked access to non-allowed endpoint: ${pathname}`);
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

    const requiresAuth = requiresAuthForEndpoint(pathname);

    if (requiresAuth) {
      try {
        const authorizationHeader = request.headers.get('authorization');
        const { user } = await verifyFirebaseToken(authorizationHeader);
        const requestHeaders = new Headers(request.headers);

        requestHeaders.set('x-user-id', user.uid);
        requestHeaders.set('x-user-email', user.email ?? '');
        requestHeaders.set('x-user-email-verified', String(user.emailVerified));

        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
        console.log(
          `[SECURITY][AUTH] Authentication failure for ${pathname} from ${ip}: ${errorMessage}`
        );

        return NextResponse.json(
          { error: 'Authentication required' },
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    // For allowed endpoints, continue with the request and add CORS headers
    const response = NextResponse.next();

    // Set CORS headers for allowed requests
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
