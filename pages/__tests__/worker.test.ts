import worker from '../_worker.js';

function assets(pages: Record<string, string>) {
  return {
    fetch: async (request: Request) => {
      const path = new URL(request.url).pathname;
      const body = pages[path];
      if (!body) return new Response('missing', { status: 404 });
      return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    },
  };
}

describe('public pages routing', () => {
  const env = {
    ASSETS: assets({
      '/legal/support.html': '<title>Support</title>',
      '/legal/privacy.html': '<title>Privacy</title>',
      '/legal/terms.html': '<title>Terms</title>',
      '/legal/membership.html': '<title>Membership</title>',
      '/information/screenshot-membership.jpg': 'membership-jpeg',
    }),
    API: { fetch: async () => new Response('api') },
  };

  it('serves /support and /support/ from the static page', async () => {
    for (const path of ['/support', '/support/']) {
      const response = await worker.fetch(new Request(`https://homecookedplate.com${path}`), env);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Support');
    }
  });

  it('does not send the browser into a slash redirect', async () => {
    const looping = {
      ASSETS: {
        fetch: async () => new Response(null, { status: 308, headers: { location: '/privacy/' } }),
      },
      API: { fetch: async () => new Response('api') },
    };
    const response = await worker.fetch(new Request('https://homecookedplate.com/privacy'), looping);
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });

  it('serves /information and /information/ from the static page', async () => {
    for (const path of ['/information', '/information/']) {
      const response = await worker.fetch(new Request(`https://homecookedplate.com${path}`), env);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Membership');
    }
  });

  it('leaves /membership for the app screen', async () => {
    const response = await worker.fetch(new Request('https://homecookedplate.com/membership'), env);
    expect(await response.text()).not.toContain('Membership');
  });

  it('serves a membership jpeg beside the page', async () => {
    const response = await worker.fetch(
      new Request('https://homecookedplate.com/information/screenshot-membership.jpg'),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('membership-jpeg');
  });

  it('keeps /privacy and /terms on their static pages', async () => {
    const privacy = await worker.fetch(new Request('https://homecookedplate.com/privacy'), env);
    const terms = await worker.fetch(new Request('https://homecookedplate.com/terms'), env);
    expect(await privacy.text()).toContain('Privacy');
    expect(await terms.text()).toContain('Terms');
  });
});
