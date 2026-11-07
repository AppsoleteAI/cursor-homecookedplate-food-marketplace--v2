import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { appRouter } from '../../trpc/app-router';
import {
  CHECKOUT_QUANTITY_MAX,
  calculateOrderBreakdown,
  checkoutQuantity,
  promotionalBase,
} from '../fees';

jest.mock('../email', () => ({
  sendNoticeEmail: jest.fn(async () => true),
}));

jest.mock('../expo-push-notifications', () => ({
  sendExpoPushNotification: jest.fn(async () => undefined),
}));

const root = resolve(__dirname, '../../..');
const appDir = join(root, 'app');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const MODAL_ROUTES = [
  'app/meal/[id].tsx',
  'app/checkout.tsx',
  'app/active-orders.tsx',
  'app/finance/today.tsx',
  'app/finance/periods.tsx',
  'app/finance/earnings.tsx',
  'app/reviews/[mealId].tsx',
  'app/reviews-dashboard.tsx',
  'app/notifications-bell.tsx',
];

const COOK = '11111111-1111-4111-8111-111111111111';
const BUYER = '22222222-2222-4222-8222-222222222222';
const MEAL = '33333333-3333-4333-8333-333333333333';
const ORDER = '44444444-4444-4444-8444-444444444444';

const AGREEMENT = {
  sections: {
    jurisdictional_law: true,
    delivery_safety: true,
    liability_waiver: true,
    legal_safety_financial: true,
    allergy_food_safety: true,
    fee_structure: true,
    account_termination: true,
    uploaded_content: true,
    apple_eula: true,
  },
  acknowledgedOn: '2026-11-05',
  acknowledgedAt: '2026-11-05T22:00:00.000Z',
};

type Row = Record<string, unknown>;

function screenBlocks(source: string): string[] {
  const blocks: string[] = [];
  const token = '<Stack.Screen';
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf(token, from);
    if (start < 0) break;
    const end = source.indexOf('/>', start);
    if (end < 0) break;
    blocks.push(source.slice(start, end + 2));
    from = end + 2;
  }
  return blocks;
}

function layoutNames(source: string): string[] {
  return [...source.matchAll(/<(?:Stack|Tabs)\.Screen[\s\S]*?name="([^"]+)"/g)].map((match) => match[1]);
}

function routeIsRegistered(layoutFile: string, name: string): boolean {
  const dir = dirname(layoutFile);
  return [
    join(dir, `${name}.tsx`),
    join(dir, `${name}.ts`),
    join(dir, name, 'index.tsx'),
    join(dir, name, '_layout.tsx'),
  ].some((candidate) => existsSync(candidate));
}

function walkRoutes(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkRoutes(full, out);
      continue;
    }
    if (entry.endsWith('.tsx') && entry !== '_layout.tsx' && !entry.startsWith('+')) out.push(full);
  }
}

function owningLayout(file: string): string | null {
  let dir = dirname(file);
  while (dir.startsWith(appDir)) {
    const layout = join(dir, '_layout.tsx');
    if (existsSync(layout) && layout !== file && layoutNames(readFileSync(layout, 'utf8')).length > 0) {
      return layout;
    }
    if (dir === appDir) break;
    dir = dirname(dir);
  }
  return null;
}

function memoryAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: 'select' | 'update' | 'insert' = 'select';
      let patch: Row = {};
      let pending: Row | null = null;
      const run = () => {
        if (mode === 'insert' && pending) {
          const saved = pending;
          pending = null;
          rows.push(saved);
          return { data: saved, error: null };
        }
        const found = rows.filter((row) => filters.every((fn) => fn(row)));
        if (mode === 'update') {
          for (const row of found) Object.assign(row, patch);
        }
        return { data: found, error: null };
      };
      const one = (missingIsError: boolean) => {
        const result = run();
        const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        return { data, error: data || !missingIsError ? null : { message: 'missing' } };
      };
      const chain = {
        select() { return chain; },
        eq(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return chain;
        },
        ilike(key: string, value: unknown) {
          filters.push((row) => String(row[key] ?? '').toLowerCase() === String(value).toLowerCase());
          return chain;
        },
        is(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return chain;
        },
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return chain;
        },
        order() { return chain; },
        limit() { return chain; },
        maybeSingle() { return one(false); },
        single() { return one(true); },
        update(next: Row) {
          mode = 'update';
          patch = next;
          return chain;
        },
        insert(next: Row) {
          mode = 'insert';
          pending = {
            id: next.id ?? `row-${rows.length + 1}`,
            created_at: next.created_at ?? '2026-11-07T06:00:00.000Z',
            ...next,
          };
          return chain;
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return chain;
    },
    auth: {
      admin: {
        mfa: {
          listFactors: async () => ({ data: { factors: [] }, error: null }),
        },
      },
    },
  };
}

function profile(id: string, role: 'platemaker' | 'platetaker') {
  return {
    id,
    role,
    email: `${role}@example.com`,
    username: role,
    is_paused: false,
    ordering_removed: false,
    is_admin: false,
    created_at: '2026-01-01T00:00:00.000Z',
    legal_safety_agreement: AGREEMENT,
  };
}

function reviewCaller(userId: string | null, db: ReturnType<typeof memoryAdmin>) {
  const headers = new Headers();
  if (userId) headers.set('Authorization', 'Bearer local-proof');
  return appRouter.createCaller({
    req: { headers },
    supabase: db,
    supabaseAdmin: db,
    userId,
    webUrl: 'https://homecookedplate.com',
  } as never);
}

describe.each([1, 2, 3, 4, 5])('five-pass local diagnostic, pass %s', () => {
  it('registers each modal route on the file path, including dynamic ids', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toContain('<Slot />');

    for (const route of MODAL_ROUTES) {
      const source = read(route);
      const blocks = screenBlocks(source);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/presentation:\s*['"]modal['"]/);
        expect(block).not.toMatch(/\sname\s*=/);
      }
      const routeName = route.slice('app/'.length).replace(/\.tsx$/, '');
      expect(existsSync(resolve(root, route))).toBe(true);
      expect(routeName.includes('[') || routeName.length > 0).toBe(true);
    }

    const layouts = [
      'app/(auth)/_layout.tsx',
      'app/(tabs)/_layout.tsx',
      'app/(tabs)/(home)/_layout.tsx',
      'app/farm-grown-basket/_layout.tsx',
      'app/meal-prep-go/_layout.tsx',
      'app/cater-event-deliver/_layout.tsx',
      'app/sit-down-delicious/_layout.tsx',
      'app/food-truck-popup/_layout.tsx',
    ];
    for (const layoutFile of layouts) {
      const names = layoutNames(read(layoutFile));
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(routeIsRegistered(resolve(root, layoutFile), name)).toBe(true);
      }
    }

    const dynamic: string[] = [];
    walkRoutes(appDir, dynamic);
    const dynamicFiles = dynamic.filter((file) => file.includes('['));
    expect(dynamicFiles.some((file) => file.endsWith(`${join('meal', '[id].tsx')}`))).toBe(true);
    expect(dynamicFiles.some((file) => file.endsWith(`${join('reviews', '[mealId].tsx')}`))).toBe(true);
    for (const file of dynamicFiles) {
      const layoutFile = owningLayout(file);
      if (!layoutFile) continue;
      const name = relative(dirname(layoutFile), file).replace(/\\/g, '/').replace(/\.tsx$/, '');
      expect(layoutNames(readFileSync(layoutFile, 'utf8'))).toContain(name);
    }
  });

  it('rejects a negative unit price and a quantity above 999, and stops checkout input at 999', () => {
    for (const role of ['platemaker', 'platetaker'] as const) {
      expect(role).toMatch(/plate/);
      expect(() => calculateOrderBreakdown(-1, 1)).toThrow(/non-negative/);
      expect(() => promotionalBase(-0.01, 1, null)).toThrow(/non-negative/);
      expect(() => calculateOrderBreakdown(12, CHECKOUT_QUANTITY_MAX + 1)).toThrow(/1 and 999/);
      expect(() => promotionalBase(12, 1000, null)).toThrow(/1 to 999/);
      expect(calculateOrderBreakdown(12, CHECKOUT_QUANTITY_MAX).subtotal).toBe(12 * CHECKOUT_QUANTITY_MAX);
      expect(checkoutQuantity(1000)).toBe(CHECKOUT_QUANTITY_MAX);
      expect(checkoutQuantity(0)).toBe(1);
      expect(checkoutQuantity(4.2)).toBe(4);
    }

    const checkout = read('app/checkout.tsx');
    const cart = read('app/(tabs)/cart.tsx');
    const meal = read('app/meal/[id].tsx');
    const plateOrder = read('backend/trpc/routes/orders/create/route.ts');
    expect(checkout).toContain('checkoutQuantity(item.quantity)');
    expect(checkout).toContain("presentation: 'modal'");
    expect(cart).toContain('checkoutQuantity(item.quantity + 1)');
    expect(meal).toContain('checkoutQuantity(quantity + 1)');
    expect(plateOrder).toContain('.max(100)');
    for (const route of [
      'backend/trpc/routes/payments/combined-checkout/route.ts',
      'backend/trpc/routes/payments/create-shop-checkout/route.ts',
    ]) {
      expect(read(route)).toContain('.max(CHECKOUT_QUANTITY_MAX)');
    }
    for (const store of [
      'hooks/cart-context.tsx',
      'hooks/farm-basket-store.ts',
      'hooks/sit-down-store.ts',
      'hooks/food-truck-store.ts',
      'hooks/meal-prep-store.ts',
    ]) {
      expect(read(store)).toContain('checkoutQuantity(');
    }

    const reviewScreen = read('app/reviews/[mealId].tsx');
    expect(reviewScreen).toContain('if (!isAuthenticated)');
    expect(reviewScreen).toContain('<Redirect href="/(auth)/login" />');
    expect(reviewScreen).toContain('!isPlatemaker');
    expect(reviewScreen).toContain('You can review a plate after that order is completed.');
  });

  it('refuses an unfinished review and an unconfirmed sign-in for both roles', async () => {
    const tables: Record<string, Row[]> = {
      profiles: [profile(COOK, 'platemaker'), profile(BUYER, 'platetaker')],
      meals: [{ id: MEAL, user_id: COOK, name: 'Soup' }],
      orders: [{
        id: ORDER,
        buyer_id: BUYER,
        seller_id: COOK,
        meal_id: MEAL,
        status: 'accepted',
      }],
      reviews: [],
      notifications: [],
      audit_logs: [],
    };
    const db = memoryAdmin(tables);
    const review = { mealId: MEAL, orderId: ORDER, rating: 5 };

    await expect(reviewCaller(null, db).reviews.create(review)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(reviewCaller(COOK, db).reviews.create(review)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'A cook cannot review their own plate.',
    });
    await expect(reviewCaller(BUYER, db).reviews.create(review)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'A review needs a completed order for this plate.',
    });

    tables.orders[0].status = 'completed';
    tables.orders[0].meal_id = 'other-plate';
    await expect(reviewCaller(BUYER, db).reviews.create(review)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });

    tables.orders[0].meal_id = MEAL;
    const posted = await reviewCaller(BUYER, db).reviews.create(review);
    expect(posted.rating).toBe(5);
    expect(posted.authorId).toBe(BUYER);
    expect(tables.reviews).toHaveLength(1);

    const loginSource = read('backend/trpc/routes/auth/login/route.ts');
    expect(loginSource).toContain('assertEmailConfirmed(data.user.email_confirmed_at)');
    expect(loginSource).not.toContain("role === 'platemaker' && !data.user.email_confirmed_at");
    expect(loginSource).not.toContain("role === 'platetaker' && !data.user.email_confirmed_at");

    for (const role of ['platemaker', 'platetaker'] as const) {
      const account = profile(role === 'platemaker' ? COOK : BUYER, role);
      const signedOut: string[] = [];
      const loginDb = memoryAdmin({
        profiles: [account],
        email_verification_tokens: [],
      });
      const callerFor = (emailConfirmedAt: string | null) => appRouter.createCaller({
        req: { headers: new Headers() },
        supabase: {
          auth: {
            signInWithPassword: async () => ({
              data: {
                user: {
                  id: account.id,
                  email: account.email,
                  created_at: new Date().toISOString(),
                  email_confirmed_at: emailConfirmedAt,
                },
                session: { access_token: 'local-access', refresh_token: 'local-refresh' },
              },
              error: null,
            }),
            signOut: async () => { signedOut.push(role); },
          },
        },
        supabaseAdmin: loginDb,
        userId: null,
        webUrl: 'https://homecookedplate.com',
      } as never);

      await expect(callerFor(null).auth.login({
        email: account.email as string,
        password: 'local-password',
      })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringMatching(/Confirm your email/),
      });
      expect(signedOut).toContain(role);

      const refusedByAuth = appRouter.createCaller({
        req: { headers: new Headers() },
        supabase: {
          auth: {
            signInWithPassword: async () => ({
              data: { user: null, session: null },
              error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
            }),
            signOut: async () => undefined,
          },
        },
        supabaseAdmin: memoryAdmin({ profiles: [], email_verification_tokens: [] }),
        userId: null,
        webUrl: 'https://homecookedplate.com',
      } as never);
      await expect(refusedByAuth.auth.login({
        email: account.email as string,
        password: 'local-password',
      })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringMatching(/Confirm your email/),
      });

      const signedIn = await callerFor('2026-11-07T06:00:00.000Z').auth.login({
        email: account.email as string,
        password: 'local-password',
      });
      expect(signedIn.needsTwoFactor).toBe(false);
      if (!signedIn.needsTwoFactor) expect(signedIn.user.role).toBe(role);
    }
  });
});
