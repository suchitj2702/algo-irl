import crypto from 'crypto';

const REQUEST_SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET || 'your-secret-key';

export function generateRequestSignature(payload: Record<string, unknown>, timestamp: number): string {
  const message = `${timestamp}:${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', REQUEST_SIGNATURE_SECRET)
    .update(message)
    .digest('hex');
}

export function verifyRequestSignature(
  payload: Record<string, unknown>,
  timestamp: number,
  signature: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes
): boolean {
  const now = Date.now();
  
  // Check timestamp is not too old or in the future
  if (now - timestamp > maxAgeMs || timestamp > now) {
    return false;
  }
  
  // Check if signature is provided and has valid format
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  
  // Verify signature
  const expectedSignature = generateRequestSignature(payload, timestamp);
  
  // Ensure both signatures have the same length before comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // If buffer creation fails, signatures are invalid
    return false;
  }
} 