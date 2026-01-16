/**
 * Web-safe Sentry shim for Rork Lightning Preview
 * 
 * The native Sentry module crashes the web preview. This shim provides
 * safe no-op implementations that prevent crashes while maintaining
 * the same API surface as the native module.
 */

export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    console.warn('[Web] Sentry.captureException (shimmed):', error.message, context);
  }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" | "fatal" | "debug" = "info") {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    console.log(`[Web] Sentry.captureMessage (shimmed) [${level}]:`, message);
  }
}

export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    console.log('[Web] Sentry.setUser (shimmed):', user);
  }
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    console.log('[Web] Sentry.addBreadcrumb (shimmed):', { message, category, data });
  }
}

// Stub Sentry object for compatibility
export const Sentry = {
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
};
