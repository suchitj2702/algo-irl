import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';
import { adminApp, adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import {
  ExpiredFirebaseTokenError,
  MalformedAuthorizationHeaderError,
  RevokedFirebaseTokenError,
  extractBearerToken,
  toCurrentUser,
  type CurrentUser,
} from './tokenUtils';

export {
  FirebaseTokenError,
  MissingAuthorizationHeaderError,
  MalformedAuthorizationHeaderError,
  ExpiredFirebaseTokenError,
  RevokedFirebaseTokenError,
  type CurrentUser,
} from './tokenUtils';

/**
 * Firebase token verification helper.
 *
 * Await this helper before accessing Firestore user data so the Firebase Admin SDK
 * (app + Firestore) is fully initialised and the caller receives a verified user identity.
 */

/**
 * Lightweight per-process cache so a handler can call verification multiple times
 * without hitting Firebase repeatedly. TTL keeps the cache bounded.
 */
const decodedTokenCache = new Map<string, CacheEntry>();
const TOKEN_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  token: string;
  decoded: DecodedIdToken;
  cachedAt: number;
}

const auth = getAuth(adminApp());

function getCachedDecodedToken(token: string): DecodedIdToken | null {
  const entry = decodedTokenCache.get(token);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAt > TOKEN_CACHE_TTL_MS) {
    decodedTokenCache.delete(token);
    return null;
  }

  return entry.decoded;
}

function cacheDecodedToken(token: string, decoded: DecodedIdToken): void {
  decodedTokenCache.set(token, {
    token,
    decoded,
    cachedAt: Date.now()
  });
}

async function verifyTokenWithFirebase(token: string): Promise<DecodedIdToken> {
  try {
    // Ensure Firestore is ready for downstream callers.
    adminDb();
    return await auth.verifyIdToken(token, true);
  } catch (error) {
    if (error instanceof Error) {
      switch ((error as { code?: string }).code) {
        case 'auth/id-token-expired':
          throw new ExpiredFirebaseTokenError();
        case 'auth/id-token-revoked':
          throw new RevokedFirebaseTokenError();
        case 'auth/argument-error':
        case 'auth/invalid-id-token':
          throw new MalformedAuthorizationHeaderError();
      }
    }

    throw error;
  }
}

/**
 * Verify an Authorization header and return the decoded token + CurrentUser metadata.
 * Throws specialised errors when the header is missing, malformed, expired, or revoked.
 */
export async function verifyFirebaseToken(authorizationHeader: string | null): Promise<{
  token: string;
  decodedToken: DecodedIdToken;
  user: CurrentUser;
}> {
  const rawToken = extractBearerToken(authorizationHeader);

  const cachedToken = getCachedDecodedToken(rawToken);
  if (cachedToken) {
    return {
      token: rawToken,
      decodedToken: cachedToken,
      user: toCurrentUser(cachedToken)
    };
  }

  const decodedToken = await verifyTokenWithFirebase(rawToken);
  cacheDecodedToken(rawToken, decodedToken);

  return {
    token: rawToken,
    decodedToken,
    user: toCurrentUser(decodedToken)
  };
}

/**
 * Extract and verify the Firebase user tied to a Next.js API request.
 * Returns the reusable token along with typed user info or throws when verification fails.
 */
export async function requireUser(request: NextRequest): Promise<{
  user: CurrentUser;
  token: string;
}> {
  const authorizationHeader = request.headers.get('authorization');
  const { token, user } = await verifyFirebaseToken(authorizationHeader);

  return {
    user,
    token
  };
}
