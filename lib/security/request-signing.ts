import crypto from 'crypto';

const REQUEST_SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET || 'your-secret-key';

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
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      valueStr = deterministicStringify(value as Record<string, unknown>);
    } else {
      valueStr = JSON.stringify(value);
    }
    
    pairs.push(`"${key}":${valueStr}`);
  }
  
  return `{${pairs.join(',')}}`;
}

export function generateRequestSignature(payload: Record<string, unknown>, timestamp: number): string {
  // Deterministic JSON serialization with sorted keys
  const deterministicPayload = deterministicStringify(payload);
  const message = `${timestamp}:${deterministicPayload}`;
  
  return crypto
    .createHmac('sha256', REQUEST_SIGNATURE_SECRET)
    .update(message)
    .digest('hex');
}

export function verifyRequestSignature(
  payload: Record<string, unknown>,
  timestamp: number,
  signature: string,
  maxAgeMs: number = 5 * 60 * 1000, // 5 minutes
  debugHeaders?: Record<string, string> // Add debug headers parameter
): boolean {
  const now = Date.now();
  
  // Enhanced logging for debugging
  const logDebugInfo = (reason: string) => {
    console.log('=== SIGNATURE VERIFICATION FAILURE ===');
    console.log('Reason:', reason);
    console.log('Server Time:', now);
    console.log('Client Timestamp:', timestamp);
    console.log('Time Difference:', now - timestamp);
    console.log('Max Age (ms):', maxAgeMs);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('Received Signature:', signature);
    console.log('Expected Signature:', generateRequestSignature(payload, timestamp));
    console.log('Signature Match:', signature === generateRequestSignature(payload, timestamp));
    
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
  
  if (timestamp > now) {
    logDebugInfo('Timestamp in future');
    return false;
  }
  
  // Check if signature is provided and has valid format
  if (!signature || typeof signature !== 'string') {
    logDebugInfo('Invalid signature format');
    return false;
  }
  
  // Verify signature
  const expectedSignature = generateRequestSignature(payload, timestamp);
  
  // Ensure both signatures have the same length before comparison
  if (signature.length !== expectedSignature.length) {
    logDebugInfo('Signature length mismatch');
    return false;
  }
  
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
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