const SECRET_KEY = /email|username|phone|password|token|secret|cookie|authorization/i;

function scrubRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubRecord);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = scrubRecord(child);
  }
  return out;
}

/** Sentry receives the account id and nothing else that identifies the person. */
export function sentryIdentity(user: { id?: string | null } | null | undefined): { id: string } | null {
  if (!user?.id) return null;
  return { id: String(user.id) };
}

type SentryScrubTarget = {
  user?: { id?: string | null; email?: string; username?: string; ip_address?: string } | null;
  request?: Record<string, unknown>;
  extra?: unknown;
  breadcrumbs?: { data?: unknown }[];
};

export function scrubSentryEvent(event: object): void {
  const target = event as SentryScrubTarget;
  if (target.user) {
    const identity = sentryIdentity(target.user);
    target.user = identity ?? undefined;
  }
  if (target.request) {
    const url = target.request.url;
    const method = target.request.method;
    target.request = {
      ...(typeof url === 'string' ? { url } : {}),
      ...(typeof method === 'string' ? { method } : {}),
    };
  }
  if (target.extra) target.extra = scrubRecord(target.extra);
  if (Array.isArray(target.breadcrumbs)) {
    target.breadcrumbs = target.breadcrumbs.map((crumb) => ({
      ...crumb,
      data: crumb.data ? scrubRecord(crumb.data) : crumb.data,
    }));
  }
}
