import * as Sentry from '@sentry/nextjs';

/**
 * Sentry initialization for server-side (Node.js) monitoring
 * This includes API routes, server components, and server actions
 */

// Validate that SENTRY_DSN is configured
const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!sentryDsn) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('⚠️  SENTRY CONFIGURATION ERROR');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error('SENTRY_DSN environment variable is missing!');
  console.error('');
  console.error('Issue reporting will NOT work without Sentry configuration.');
  console.error('Users will receive errors when trying to report issues.');
  console.error('');
  console.error('To fix this:');
  console.error('1. Create a Sentry project at https://sentry.io');
  console.error('2. Get your DSN from: https://sentry.io/settings/[org]/projects/[project]/keys/');
  console.error('3. Add to .env.local: SENTRY_DSN=your_dsn_here');
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
}

Sentry.init({
  dsn: sentryDsn,
  environment: process.env.NODE_ENV || 'development',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable capturing of console logs
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),
  ],

  // Filter sensitive data before sending to Sentry
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-firebase-token'];
    }

    // Remove sensitive environment variables
    if (event.contexts?.runtime?.env) {
      const env = event.contexts.runtime.env as Record<string, unknown>;
      delete env.FIREBASE_SERVICE_ACCOUNT_KEY;
      delete env.RAZORPAY_KEY_SECRET;
      delete env.ANTHROPIC_API_KEY;
      delete env.OPENAI_API_KEY;
      delete env.GEMINI_API_KEY;
      delete env.ENCRYPTION_KEY;
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Common network errors
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    // Client disconnections
    'Client closed request',
  ],
});
