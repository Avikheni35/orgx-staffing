import { env } from '../config/env';

let sentryInitialized = false;

export async function initSentry(): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as { init: (o: object) => void };
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    });
    sentryInitialized = true;
    console.log('[Sentry] Initialized for M1');
  } catch {
    console.warn('[Sentry] @sentry/node not installed — error tracking disabled. Run: npm install -w m1/server');
  }
}

export async function captureException(err: unknown): Promise<void> {
  if (!sentryInitialized || !env.SENTRY_DSN) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as { captureException: (e: unknown) => void };
    Sentry.captureException(err);
  } catch { /* no-op */ }
}
