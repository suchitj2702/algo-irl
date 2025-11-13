/**
 * Sentry initialization for server-side (Node.js) monitoring
 * This file is automatically loaded by Next.js instrumentation hooks
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side initialization is in sentry.server.config.ts
    await import('./sentry.server.config');
  }
}
