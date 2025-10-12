export function getCorsHeaders(origin: string | null): HeadersInit {
  // Define allowed origins (production origins)
  const allowedOrigins = [
    'https://algo-irl.vercel.app',
    'https://www.algoirl.ai',
    'https://algoirl.ai',
    // Add localhost for development
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : [])
  ];

  // Only allow explicitly whitelisted origins
  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    // FIX: Remove wildcard fallback - only allow whitelisted origins
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // Simplified headers list - removed excessive debug headers
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Signature, X-Request-Id, X-Hp-Field, X-Client-Fingerprint',
    'Access-Control-Max-Age': '86400',
  };
} 