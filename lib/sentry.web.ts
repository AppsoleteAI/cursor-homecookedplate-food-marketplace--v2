/**
 * Web Sentry client.
 * The native module crashes the web preview, so web uses the browser SDK.
 */
import * as SentryBrowser from '@sentry/browser';
import { SENTRY_TRACE_SAMPLE_RATE } from '@/lib/sentry-rate';

let ready = false;

function dsn(): string | undefined {
  const value = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return value && value.length > 0 ? value : undefined;
}

function start(options?: { dsn?: string; tracesSampleRate?: number; debug?: boolean; environment?: string }) {
  if (ready) return;
  const value = options?.dsn || dsn();
  if (!value) return;
  const requested = options?.tracesSampleRate;
  const tracesSampleRate = typeof requested === 'number' && requested > 0 && requested < 1
    ? requested
    : SENTRY_TRACE_SAMPLE_RATE;
  try {
    SentryBrowser.init({
      dsn: value,
      debug: options?.debug,
      environment: options?.environment,
      tracesSampleRate,
    });
    ready = true;
  } catch (error) {
    console.warn('[Web] Sentry init failed', error);
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (!dsn()) return;
  start();
  SentryBrowser.captureException(error, { extra: context });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" | "fatal" | "debug" = "info") {
  if (!dsn()) return;
  start();
  SentryBrowser.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (!dsn()) return;
  start();
  SentryBrowser.setUser(user);
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!dsn()) return;
  start();
  SentryBrowser.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

export const Sentry = {
  init: start,
  wrap: (component: any) => component,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
};
