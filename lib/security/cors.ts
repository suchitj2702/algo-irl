export function getCorsHeaders(origin: string | null): HeadersInit {
  // Define allowed origins (update for production)
  const allowedOrigins = [
    'http://localhost:3000',
    'https://algo-irl.vercel.app',
    // Add your production domains
  ];
  
  const isAllowed = !origin || allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
} 