import { app } from '../../hono';
import { productionApiOrigin } from '../api-origin';

function preflight(origin: string | undefined, env?: Record<string, string>) {
  const headers: Record<string, string> = {
    'Access-Control-Request-Method': 'POST',
  };
  if (origin) headers.Origin = origin;
  return app.request('http://localhost/api/trpc/auth.me', { method: 'OPTIONS', headers }, env);
}

describe('production API origins', () => {
  it('refuses Expo tunnel hosts and a missing Origin', () => {
    expect(productionApiOrigin('https://cook.expo.dev', true)).toBeNull();
    expect(productionApiOrigin('https://cook.exp.direct', true)).toBeNull();
    expect(productionApiOrigin(undefined, true)).toBeNull();
    expect(productionApiOrigin('', true)).toBeNull();
    expect(productionApiOrigin('https://homecookedplate.com', true)).toBe('https://homecookedplate.com');
    expect(productionApiOrigin('https://www.homecookedplate.com', true)).toBe('https://www.homecookedplate.com');
    expect(productionApiOrigin('https://homecookedplate.pages.dev', true)).toBe('https://homecookedplate.pages.dev');
    expect(productionApiOrigin('http://localhost:8081', true)).toBe('http://localhost:8081');
  });

  it('keeps Expo tunnels on a non-production Worker', () => {
    expect(productionApiOrigin('https://cook.expo.dev', false)).toBe('https://cook.expo.dev');
    expect(productionApiOrigin(undefined, false)).toBe('*');
  });

  it('the Worker answers those origins', async () => {
    const production = { ENVIRONMENT: 'production' };
    const expo = await preflight('https://preview.expo.dev', production);
    const tunnel = await preflight('https://aa.exp.direct', production);
    const blank = await preflight(undefined, production);
    const site = await preflight('https://homecookedplate.com', production);
    const pages = await preflight('https://homecookedplate.pages.dev', production);
    expect(expo.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(tunnel.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(blank.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(site.headers.get('Access-Control-Allow-Origin')).toBe('https://homecookedplate.com');
    expect(pages.headers.get('Access-Control-Allow-Origin')).toBe('https://homecookedplate.pages.dev');
  });
});
