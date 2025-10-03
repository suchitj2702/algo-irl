/**
 * Environment Variable Loader
 *
 * This module MUST be imported first in any script that needs .env.local variables.
 * It loads environment variables during the import phase, ensuring they're available
 * when other modules' constructors run at module-load time.
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local file
const envPath = path.join(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    // Parse KEY=VALUE format
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim()
        .replace(/^["']|["']$/g, ''); // Remove quotes

      // Only set if not already in environment
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✓ Loaded environment variables from .env.local\n');
} else {
  console.warn('⚠ Warning: .env.local not found. Make sure environment variables are set.\n');
}
