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
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Max-Age': '86400',
  };
} 