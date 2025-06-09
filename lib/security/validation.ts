export const SecurityLimits = {
  MAX_CODE_LENGTH: 50000, // 50KB max code size
  MAX_COMPANY_NAME_LENGTH: 100,
  MAX_CUSTOM_COMPANY_NAMES_PER_DAY: 10,
  MAX_TEST_CASES: 150,
  MAX_EXECUTION_TIME_MS: 10000, // 10 seconds
  MAX_MEMORY_MB: 256,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateCodeSubmission(code: string, _language: string): { valid: boolean; error?: string } {
  // Check code length
  if (code.length > SecurityLimits.MAX_CODE_LENGTH) {
    return { valid: false, error: `Code exceeds maximum length of ${SecurityLimits.MAX_CODE_LENGTH} characters` };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /import\s+os/gi, // Python OS operations
    /require\s*\(\s*['"]child_process['"]\s*\)/gi, // Node.js process spawning
    /eval\s*\(/gi, // Eval usage
    /exec\s*\(/gi, // Exec usage
    /__import__/gi, // Python dynamic imports
    /subprocess/gi, // Python subprocess
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(code)) {
      return { valid: false, error: 'Code contains potentially dangerous operations' };
    }
  }
  
  return { valid: true };
} 