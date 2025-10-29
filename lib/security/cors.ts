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

export function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = getAllowedOrigins();
  const fallbackOrigin = allowedOrigins[0] ?? '';
  const isAllowed = origin && allowedOrigins.includes(origin);
  const selectedOrigin = isAllowed ? origin : fallbackOrigin;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };

  if (selectedOrigin) {
    headers['Access-Control-Allow-Origin'] = selectedOrigin;
  }

  return headers;
} 
