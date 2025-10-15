export interface CurrentUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  providerIds: string[];
}

export abstract class FirebaseTokenError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;

  protected constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MissingAuthorizationHeaderError extends FirebaseTokenError {
  constructor() {
    super('Authorization header is required', 401, 'missing_authorization_header');
  }
}

export class MalformedAuthorizationHeaderError extends FirebaseTokenError {
  constructor() {
    super('Authorization header must use the Bearer scheme', 401, 'malformed_authorization_header');
  }
}

export class ExpiredFirebaseTokenError extends FirebaseTokenError {
  constructor() {
    super('Firebase ID token has expired', 401, 'expired_firebase_token');
  }
}

export class RevokedFirebaseTokenError extends FirebaseTokenError {
  constructor() {
    super('Firebase ID token has been revoked', 403, 'revoked_firebase_token');
  }
}

export function extractBearerToken(headerValue: string | null): string {
  if (!headerValue) {
    throw new MissingAuthorizationHeaderError();
  }

  const [scheme, token] = headerValue.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new MalformedAuthorizationHeaderError();
  }

  return token;
}

interface FirebaseIdentitiesClaim {
  identities?: Record<string, unknown>;
  sign_in_provider?: string;
}

interface FirebaseTokenLike {
  uid: string;
  email?: string | null;
  email_verified?: boolean;
  firebase?: FirebaseIdentitiesClaim;
}

export function toCurrentUser(token: FirebaseTokenLike): CurrentUser {
  const identities = token.firebase?.identities;

  const providerIds = identities
    ? Object.keys(identities)
    : token.firebase?.sign_in_provider
      ? [token.firebase.sign_in_provider]
      : [];

  return {
    uid: token.uid,
    email: token.email ?? null,
    emailVerified: token.email_verified ?? false,
    providerIds,
  };
}
