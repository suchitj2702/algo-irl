import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  // Remove any HTML/script tags
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  
  // Additional sanitization for common injection patterns
  return cleaned
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

export function sanitizeCompanyName(name: string): string {
  // Allow only alphanumeric, spaces, hyphens, and common business characters
  return name
    .replace(/[^a-zA-Z0-9\s\-&.,'"]/g, '')
    .trim()
    .substring(0, 100); // Enforce max length
} 