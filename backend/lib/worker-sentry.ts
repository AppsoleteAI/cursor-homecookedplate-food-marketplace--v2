import { SENTRY_TRACE_SAMPLE_RATE } from '../../lib/sentry-rate';
import { scrubSentryEvent, sentryIdentity } from '../../lib/sentry-user';
import { safeRequestId } from './request-id';

export type PublicReadName = 'listMeals' | 'getMeal' | 'listReviews';

/** Same 10% as the app traces. A crash is not sampled. */
export function publicReadSampled(roll: number, rate = SENTRY_TRACE_SAMPLE_RATE): boolean {
  return Number.isFinite(roll) && roll >= 0 && roll < rate;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /Bearer\s+\S+/gi;
const SECRET_VALUE = /\b(?:sk|rk|whsec|sbp)_[A-Za-z0-9]+/g;

/** Drop mail addresses and secret-shaped values before a crash leaves the Worker. */
export function scrubCrashText(value: string): string {
  return value.replace(EMAIL, '[email]').replace(BEARER, 'Bearer [token]').replace(SECRET_VALUE, '[secret]');
}

export function sentryStoreTarget(dsn: string): { url: string; key: string } | null {
  try {
    const parsed = new URL(dsn);
    const key = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, '');
    if (!key || !/^\d+$/.test(projectId)) return null;
    return { url: `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`, key };
  } catch {
    return null;
  }
}

export function workerSentryDsn(env?: {
  SENTRY_DSN?: string;
  EXPO_PUBLIC_SENTRY_DSN?: string;
} | null): string | undefined {
  return env?.SENTRY_DSN || env?.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;
}

/**
 * Sends one Worker crash to Sentry. The account id is the only identity.
 * No DSN means the crash stays in the Worker log.
 */
export async function reportWorkerCrash(input: {
  error: unknown;
  method?: string;
  path?: string;
  userId?: string | null;
  dsn?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const dsn = input.dsn?.trim();
  if (!dsn) return false;
  const target = sentryStoreTarget(dsn);
  if (!target) return false;

  const message = scrubCrashText(input.error instanceof Error ? input.error.message : 'unknown');
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    logger: 'plate-marketplace-api',
    exception: {
      values: [{ type: input.error instanceof Error ? input.error.name : 'Error', value: message }],
    },
    user: sentryIdentity(input.userId ? { id: input.userId } : null) ?? undefined,
    request: {
      ...(input.path ? { url: scrubCrashText(input.path) } : {}),
      ...(input.method ? { method: input.method } : {}),
    },
    extra: { runtime: 'worker' },
  };
  scrubSentryEvent(event);

  try {
    const send = input.fetchImpl ?? fetch;
    const response = await send(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=hcp-worker/1.0`,
      },
      body: JSON.stringify(event),
    });
    return response.ok;
  } catch {
    console.error('[Sentry] Worker crash was not sent.');
    return false;
  }
}

/**
 * Sends one public-read timing to the same Sentry store as a crash.
 * One in ten is sent. No DSN means the Worker log is the only record.
 * The account id is the only identity. A signed-out read has none.
 */
export async function reportPublicReadTiming(input: {
  read: PublicReadName;
  ms: number;
  requestId?: unknown;
  userId?: string | null;
  dsn?: string | null;
  roll?: number;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const dsn = input.dsn?.trim();
  if (!dsn) return false;
  const roll = input.roll ?? Math.random();
  if (!publicReadSampled(roll)) return false;
  const target = sentryStoreTarget(dsn);
  if (!target) return false;

  const ms = Number.isFinite(input.ms) && input.ms >= 0 ? Math.round(input.ms) : 0;
  const end = Date.now() / 1000;
  const trace = crypto.randomUUID().replace(/-/g, '');
  const event = {
    event_id: trace,
    type: 'transaction',
    transaction: input.read,
    platform: 'javascript',
    logger: 'plate-marketplace-api',
    start_timestamp: end - ms / 1000,
    timestamp: end,
    contexts: {
      trace: {
        trace_id: trace,
        span_id: trace.slice(0, 16),
        op: 'db',
        status: 'ok',
      },
    },
    measurements: {
      public_read: { value: ms, unit: 'millisecond' },
    },
    tags: { read: input.read },
    extra: { runtime: 'worker', request_id: safeRequestId(input.requestId) },
    user: sentryIdentity(input.userId ? { id: input.userId } : null) ?? undefined,
  };
  scrubSentryEvent(event);

  try {
    const send = input.fetchImpl ?? fetch;
    const response = await send(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=hcp-worker/1.0`,
      },
      body: JSON.stringify(event),
    });
    return response.ok;
  } catch {
    console.error('[Sentry] Public read timing was not sent.');
    return false;
  }
}
