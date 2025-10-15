import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import {
  ExpiredFirebaseTokenError,
  MalformedAuthorizationHeaderError,
  extractBearerToken,
  toCurrentUser,
  type CurrentUser,
} from './tokenUtils';

const FIREBASE_JWKS_URL = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID must be set to verify Firebase ID tokens.');
}

const issuer = `https://securetoken.google.com/${projectId}`;

const jwks = createRemoteJWKSet(FIREBASE_JWKS_URL);

const decodedTokenCache = new Map<string, CacheEntry>();
const TOKEN_CACHE_TTL_MS = 30_000;

interface FirebaseJwtPayload extends JWTPayload {
  uid?: string;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    identities?: Record<string, unknown>;
    sign_in_provider?: string;
  };
}

interface CacheEntry {
  token: string;
  payload: FirebaseJwtPayload;
  cachedAt: number;
}

function getCachedDecodedToken(token: string): FirebaseJwtPayload | null {
  const entry = decodedTokenCache.get(token);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAt > TOKEN_CACHE_TTL_MS) {
    decodedTokenCache.delete(token);
    return null;
  }

  return entry.payload;
}

function cacheDecodedToken(token: string, payload: FirebaseJwtPayload): void {
  decodedTokenCache.set(token, {
    token,
    payload,
    cachedAt: Date.now(),
  });
}

async function verifyToken(token: string): Promise<FirebaseJwtPayload> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: projectId,
    });

    const firebasePayload: FirebaseJwtPayload = {
      ...payload,
      uid: (payload as FirebaseJwtPayload).user_id ?? (payload.sub as string | undefined),
      firebase: (payload as FirebaseJwtPayload).firebase,
      email: (payload as FirebaseJwtPayload).email,
      email_verified: (payload as FirebaseJwtPayload).email_verified,
    };

    if (!firebasePayload.uid) {
      throw new MalformedAuthorizationHeaderError();
    }

    return firebasePayload;
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new ExpiredFirebaseTokenError();
    }

    if (
      error instanceof joseErrors.JWTInvalid ||
      error instanceof joseErrors.JWTClaimValidationFailed ||
      error instanceof joseErrors.JWSSignatureVerificationFailed
    ) {
      throw new MalformedAuthorizationHeaderError();
    }

    throw error;
  }
}

export async function verifyFirebaseToken(authorizationHeader: string | null): Promise<{
  token: string;
  decodedToken: FirebaseJwtPayload;
  user: CurrentUser;
}> {
  const rawToken = extractBearerToken(authorizationHeader);

  const cachedPayload = getCachedDecodedToken(rawToken);
  if (cachedPayload) {
    return {
      token: rawToken,
      decodedToken: cachedPayload,
      user: toCurrentUser({
        uid: cachedPayload.user_id ?? (cachedPayload.sub as string),
        email: cachedPayload.email ?? null,
        email_verified: cachedPayload.email_verified ?? false,
        firebase: cachedPayload.firebase,
      }),
    };
  }

  const payload = await verifyToken(rawToken);
  cacheDecodedToken(rawToken, payload);

  return {
    token: rawToken,
    decodedToken: payload,
    user: toCurrentUser({
      uid: payload.user_id ?? (payload.sub as string),
      email: payload.email ?? null,
      email_verified: payload.email_verified ?? false,
      firebase: payload.firebase,
    }),
  };
}

export type { CurrentUser } from './tokenUtils';
