import crypto from 'crypto';
import { kv } from '@vercel/kv';

// CRITICAL: Fail fast if secret not configured in production
const REQUEST_SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET;
if (!REQUEST_SIGNATURE_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SECURITY ERROR: REQUEST_SIGNATURE_SECRET environment variable must be set');
}

// Add version prefix for future algorithm upgrades
const SIGNATURE_VERSION = 'v1';

// Add helper function for deterministic JSON serialization
function deterministicStringify(obj: Record<string, unknown>): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);

  // Sort keys to ensure consistent ordering with frontend
  const sortedKeys = Object.keys(obj).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const value = obj[key];
    let valueStr: string;

    if (Array.isArray(value)) {
      // FIX: Sort arrays for deterministic serialization
      const sortedArray = [...value].sort((a, b) => {
        const aStr = JSON.stringify(a);
        const bStr = JSON.stringify(b);
        return aStr.localeCompare(bStr);
      });
      valueStr = JSON.stringify(sortedArray);
    } else if (value && typeof value === 'object') {
      valueStr = deterministicStringify(value as Record<string, unknown>);
    } else {
      valueStr = JSON.stringify(value);
    }

    pairs.push(`"${key}":${valueStr}`);
  }

  return `{${pairs.join(',')}}`;
}

export function generateRequestSignature(
  payload: Record<string, unknown>,
  timestamp: number,
  nonce: string
): string {
  // Deterministic JSON serialization with sorted keys
  const deterministicPayload = deterministicStringify(payload);
  const message = `${SIGNATURE_VERSION}:${timestamp}:${nonce}:${deterministicPayload}`;

  const signature = crypto
    .createHmac('sha256', REQUEST_SIGNATURE_SECRET!)
    .update(message)
    .digest('hex');

  return `${SIGNATURE_VERSION}:${signature}`;
}

export async function verifyRequestSignature(
  payload: Record<string, unknown>,
  timestamp: number,
  signature: string,
  nonce: string,
  maxAgeMs: number = 5 * 60 * 1000, // 5 minutes
  debugHeaders?: Record<string, string> // Add debug headers parameter
): Promise<boolean> {
  const now = Date.now();

  // Enhanced logging for debugging (only when DEBUG_SIGNATURES=true)
  const logDebugInfo = (reason: string) => {
    if (process.env.DEBUG_SIGNATURES !== 'true') return;

    console.log('=== SIGNATURE VERIFICATION FAILURE ===');
    console.log('Reason:', reason);
    console.log('Server Time:', now);
    console.log('Client Timestamp:', timestamp);
    console.log('Time Difference:', now - timestamp);
    console.log('Max Age (ms):', maxAgeMs);
    console.log('Nonce:', nonce);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('Received Signature:', signature);

    if (debugHeaders) {
      console.log('Debug Headers:', JSON.stringify(debugHeaders, null, 2));
    }
    console.log('=====================================');
  };

  // Check timestamp is not too old or in the future
  if (now - timestamp > maxAgeMs) {
    logDebugInfo('Timestamp too old');
    return false;
  }

  if (timestamp > now + 60000) { // Allow 1 minute clock skew
    logDebugInfo('Timestamp in future');
    return false;
  }

  // Check if nonce is provided
  if (!nonce || typeof nonce !== 'string' || nonce.length < 16) {
    logDebugInfo('Invalid or missing nonce');
    return false;
  }

  // Check nonce hasn't been used before (prevent replay attacks)
  try {
    const nonceKey = `nonce:${nonce}`;
    const nonceExists = await kv.exists(nonceKey);
    if (nonceExists) {
      logDebugInfo('Nonce already used (replay attack detected)');
      return false;
    }

    // Store nonce with expiration
    await kv.set(nonceKey, timestamp, {
      ex: Math.ceil(maxAgeMs / 1000) + 60 // Add 1 minute buffer
    });
  } catch (error) {
    console.error('KV error checking nonce:', error);
    // If KV is down, still allow request but log warning
    console.warn('WARNING: Nonce check failed due to KV error - potential replay attack vulnerability');
  }

  // Check if signature is provided and has valid format
  if (!signature || typeof signature !== 'string') {
    logDebugInfo('Invalid signature format');
    return false;
  }

  // Verify signature version
  if (!signature.startsWith(`${SIGNATURE_VERSION}:`)) {
    logDebugInfo('Invalid signature version');
    return false;
  }

  // Verify signature
  const expectedSignature = generateRequestSignature(payload, timestamp, nonce);

  // Ensure both signatures have the same length before comparison
  if (signature.length !== expectedSignature.length) {
    logDebugInfo('Signature length mismatch');
    return false;
  }

  try {
    // Extract signature content after version prefix
    const signatureContent = signature.split(':')[1];
    const expectedContent = expectedSignature.split(':')[1];

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureContent, 'hex'),
      Buffer.from(expectedContent, 'hex')
    );

    if (!isValid) {
      logDebugInfo('Signature verification failed');
    }

    return isValid;
  } catch (error) {
    logDebugInfo(`Buffer creation failed: ${error}`);
    return false;
  }
}
