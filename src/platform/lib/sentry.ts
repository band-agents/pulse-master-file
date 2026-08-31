/**
 * Sentry wiring — no-op unless VITE_SENTRY_DSN is set, so demo mode,
 * local dev, and CI run clean without a Sentry account.
 *
 * To activate: create a project at sentry.io → copy the DSN →
 * add VITE_SENTRY_DSN=... to .env.local (and the Vercel env).
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const sentryEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Errors only for now — tracing/replay can come later if needed.
    tracesSampleRate: 0,
  });
}

/** Report an error with optional context. Safe to call when disabled. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
