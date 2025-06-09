import crypto from 'crypto';

export function generateFingerprint(request: Request): string {
  const headers = request.headers;
  
  // Collect fingerprint components
  const components = [
    headers.get('user-agent') || '',
    headers.get('accept-language') || '',
    headers.get('accept-encoding') || '',
    headers.get('x-forwarded-for') || headers.get('x-real-ip') || '',
    headers.get('cf-connecting-ip') || '', // Cloudflare
    headers.get('x-vercel-forwarded-for') || '', // Vercel
  ];
  
  // Create a hash of the components
  const fingerprint = crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
    
  return fingerprint;
} 