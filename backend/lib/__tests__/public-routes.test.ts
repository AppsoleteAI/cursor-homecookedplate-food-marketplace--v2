import { app } from '../../hono';
import { appRouter } from '../../trpc/app-router';

describe('production router', () => {
  it('does not mount the public diagnostic routes', () => {
    const procedures = appRouter._def.procedures as Record<string, unknown>;
    expect(procedures['system.dbHealth']).toBeUndefined();
    expect(procedures['health.check']).toBeUndefined();
    expect(procedures['supabase.test']).toBeUndefined();
    expect(procedures['example.hi']).toBeUndefined();
    expect(procedures['auth.login']).toBeDefined();
    expect(procedures['orders.create']).toBeDefined();
    expect(procedures['platemaker.getDashboardStats']).toBeDefined();
  });

  it('those paths are not served', async () => {
    for (const path of [
      '/api/trpc/system.dbHealth',
      '/api/trpc/health.check',
      '/api/trpc/supabase.test',
      '/api/trpc/example.hi',
    ]) {
      const response = await app.request(`http://localhost${path}`, { method: 'GET' }, {
        ENVIRONMENT: 'production',
      });
      const body = await response.text();
      expect(body).not.toMatch(/profilesCount|tablesExist|hello/i);
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });
});
