function parseOrigins(value: string | undefined | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  const envOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const appUrlOrigins = parseOrigins(process.env.NEXT_PUBLIC_APP_URL);
  const defaultOrigins = [
    'https://algo-irl.vercel.app',
    'https://www.algoirl.ai',
    'https://algoirl.ai',
  ];

  const baseOrigins = envOrigins.length > 0 ? envOrigins : [...appUrlOrigins, ...defaultOrigins];
  const devOrigins =
    process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']
      : [];

  const deduped = new Set([...baseOrigins, ...devOrigins].filter(Boolean));

  return Array.from(deduped);
}

export function getCorsHeaders(origin: string | null, request?: Request | null): HeadersInit {
  const allowedOrigins = getAllowedOrigins();

  // Handle corporate proxy scenarios where origin might be null or 'null' string
  let effectiveOrigin = origin;

  // If origin is missing or 'null' (string), try to extract from referer
  if (!effectiveOrigin || effectiveOrigin === 'null') {
    if (request) {
      const referer = request.headers.get('referer');
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          effectiveOrigin = refererUrl.origin;
          console.log('[CORS] Using referer as origin fallback:', {
            originalOrigin: origin,
            referer: referer.substring(0, 100),
            extractedOrigin: effectiveOrigin,
          });
        } catch {
          console.log('[CORS] Failed to parse referer:', referer);
        }
      }
    }
  }

  // Check if the effective origin is allowed
  const isAllowed = effectiveOrigin && allowedOrigins.includes(effectiveOrigin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer, User-Agent',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };

  // Only set Access-Control-Allow-Origin if we have a valid, allowed origin
  // Do NOT use fallback origin as it causes CORS errors when origin doesn't match
  if (isAllowed && effectiveOrigin) {
    headers['Access-Control-Allow-Origin'] = effectiveOrigin;
  } else if (!effectiveOrigin || effectiveOrigin === 'null') {
    // For corporate proxies that strip origin, we need to be more permissive
    // but still secure - we'll rely on authentication for actual security
    console.log('[CORS] Missing or null origin - possible corporate proxy');
    // Don't set Access-Control-Allow-Origin, which will cause preflight to fail properly
    // Rather than setting wrong origin
  } else {
    // Origin provided but not in allowlist
    console.log('[CORS] Origin not in allowlist:', effectiveOrigin);
  }

  return headers;
} 
