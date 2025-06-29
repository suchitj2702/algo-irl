export function getCorsHeaders(origin: string | null): HeadersInit {
  // Define allowed origins (update for production)
  const allowedOrigins = [
    'https://algo-irl.vercel.app/',
    'https://www.algoirl.ai',
    'https://algoirl.ai',
  ];
  
  const isAllowed = !origin || allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Signature, X-Hp-Field, X-Client-Fingerprint, X-Requested-With, X-Debug-Client-Time, X-Debug-Request-Id, X-Debug-Client-Version, X-Debug-Payload-Keys, X-Debug-Payload-Size, X-Debug-Signature-Method, X-Debug-Browser, X-Debug-User-Agent, X-Debug-Session-Id, X-Debug-Endpoint',
    'Access-Control-Max-Age': '86400',
  };
} 