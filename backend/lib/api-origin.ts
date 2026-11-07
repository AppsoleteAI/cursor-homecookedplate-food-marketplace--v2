const PRODUCTION_ORIGINS = new Set([
  'https://homecookedplate.com',
  'https://www.homecookedplate.com',
  'https://homecookedplate.pages.dev',
  'https://homecookedplate-marketplace.vercel.app',
]);

export function apiIsProduction(env: unknown): boolean {
  const bound = env && typeof env === 'object' && 'ENVIRONMENT' in env
    ? (env as { ENVIRONMENT?: unknown }).ENVIRONMENT
    : undefined;
  const name = typeof bound === 'string' ? bound : process.env.ENVIRONMENT || process.env.NODE_ENV;
  return name === 'production';
}

/**
 * Production allows the website origins only.
 * Expo tunnel hosts and a missing Origin are refused.
 * A request with no Origin still reaches the Worker from the phones.
 * The browser is what enforces this header.
 */
export function productionApiOrigin(origin: string | undefined, production: boolean): string | null {
  if (!production) {
    return origin || '*';
  }
  if (!origin) return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return origin;
  }
  if (url.hostname.endsWith('.exp.direct') || url.hostname.endsWith('.expo.dev')) {
    return null;
  }
  return PRODUCTION_ORIGINS.has(origin) ? origin : null;
}
