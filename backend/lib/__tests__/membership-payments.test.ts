import { appRouter } from '../../trpc/app-router';
import { buyerServiceFeePercent, calculateFees, finalPlateReceipt, membershipPriceCents, membershipProductName } from '../fees';
import { writeResolvedTier } from '../store-membership';
import { clipPostAllowed, platemakerMayEnter, resolvedMembershipTier } from '../trial-access';

jest.mock('../email', () => ({
  sendNoticeEmail: jest.fn(async () => true),
}));

const RUNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const COOK = '11111111-1111-4111-8111-111111111111';
const BUYER = '22222222-2222-4222-8222-222222222222';

type Row = Record<string, unknown>;

const PLANS = [
  { role: 'platemaker' as const, interval: 'month' as const, cents: 499, userId: COOK },
  { role: 'platemaker' as const, interval: 'year' as const, cents: 3999, userId: COOK },
  { role: 'platetaker' as const, interval: 'month' as const, cents: 799, userId: BUYER },
  { role: 'platetaker' as const, interval: 'year' as const, cents: 7599, userId: BUYER },
];

function memoryAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: 'select' | 'update' = 'select';
      let patch: Row = {};
      const run = () => {
        const matched = rows.filter((row) => filters.every((fn) => fn(row)));
        if (mode === 'update') {
          for (const row of matched) Object.assign(row, patch);
        }
        return { data: matched, error: null };
      };
      const chain = {
        select() { return chain; },
        eq(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return chain;
        },
        maybeSingle() {
          const result = run();
          return { data: result.data[0] ?? null, error: null };
        },
        single() {
          const result = run();
          const data = result.data[0] ?? null;
          return { data, error: data ? null : { message: 'missing' } };
        },
        update(next: Row) {
          mode = 'update';
          patch = next;
          return chain;
        },
        insert(row: Row) {
          const saved = { ...row };
          rows.push(saved);
          filters.length = 0;
          filters.push((item) => item === saved);
          mode = 'select';
          return chain;
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown) {
          return Promise.resolve(run()).then(resolve);
        },
      };
      return chain;
    },
  };
}

function caller(userId: string | null, db: ReturnType<typeof memoryAdmin>, signedIn = true) {
  return appRouter.createCaller({
    req: { headers: new Headers(signedIn ? { Authorization: 'Bearer local-proof' } : {}) },
    supabase: db,
    supabaseAdmin: db,
    userId,
    webUrl: 'https://homecookedplate.com',
    stripeSecretKey: 'local-stripe-test',
  } as never);
}

function profile(id: string, role: 'platemaker' | 'platetaker'): Row {
  return {
    id,
    role,
    email: `${role}@example.com`,
    username: role,
    is_paused: false,
    created_at: '2026-01-01T00:00:00.000Z',
    legal_safety_agreement: {
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
    },
    membership_tier: 'free',
    metro_area: 'Los Angeles-Long Beach-Anaheim',
    trial_ends_at: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };
}

describe.each(RUNS)('four membership payments and premium access, run %s', () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  let fetchMock: { mockRestore: () => void };

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'local-stripe-test';
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/customers')) {
        return { ok: true, json: async () => ({ id: 'cus_local' }) } as Response;
      }
      if (url.endsWith('/v1/checkout/sessions')) {
        const params = new URLSearchParams(String(init?.body || ''));
        return {
          ok: true,
          json: async () => ({
            id: `cs_${params.get('metadata[role]')}_${params.get('metadata[interval]')}`,
            url: 'https://checkout.stripe.test/local',
            unitAmount: params.get('line_items[0][price_data][unit_amount]'),
            interval: params.get('line_items[0][price_data][recurring][interval]'),
            name: params.get('line_items[0][price_data][product_data][name]'),
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  });

  it('charges the role price for both months and both years, then opens Premium', async () => {
    expect(clipPostAllowed(null)).toBe(false);
    expect(platemakerMayEnter({ role: 'platemaker', membership_tier: 'free' })).toBe(false);
    expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'free', baseAmount: 30 })).toBe(10);

    for (const plan of PLANS) {
      expect(membershipPriceCents(plan.role, plan.interval)).toBe(plan.cents);
      const tables = memoryAdmin({
        profiles: [profile(COOK, 'platemaker'), profile(BUYER, 'platetaker')],
      });
      await expect(caller(null, tables, false).payments.createCheckoutSession({
        interval: plan.interval,
        returnUrl: 'https://homecookedplate.com/membership',
      })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      const signedOutClaims = await tables.from('stripe_identity_claims').select();
      expect(signedOutClaims.data).toEqual([]);

      const session = await caller(plan.userId, tables).payments.createCheckoutSession({
        interval: plan.interval,
        returnUrl: 'https://homecookedplate.com/membership',
      });
      const claim = await tables.from('stripe_identity_claims').select().eq('profile_id', plan.userId).eq('kind', 'customer').maybeSingle();
      expect(claim.data).toMatchObject({
        stripe_id: 'cus_local',
        kind: 'customer',
        profile_id: plan.userId,
      });
      const saved = await tables.from('profiles').select().eq('id', plan.userId);
      const row = (saved.data as Row[])[0];
      expect(row.stripe_customer_id).toBe('cus_local');
      expect(session.role).toBe(plan.role);
      expect(session.interval).toBe(plan.interval);
      expect(session.unitAmount).toBe(plan.cents);
      expect(session.checkoutUrl).toBe('https://checkout.stripe.test/local');
      const other = plan.role === 'platemaker' ? 799 : 499;
      expect(session.unitAmount).not.toBe(other);

      expect(resolvedMembershipTier(row as never)).toBe('free');
      expect(clipPostAllowed({
        role: plan.role,
        membershipTier: 'free',
        stripeSubscriptionId: null,
      })).toBe(false);

      row.stripe_subscription_id = `sub_${plan.role}_${plan.interval}`;
      const tier = await writeResolvedTier(tables, row as never);
      expect(tier).toBe('premium');
      expect(row.membership_tier).toBe('premium');
      expect(clipPostAllowed({
        role: plan.role,
        membershipTier: String(row.membership_tier),
        stripeSubscriptionId: String(row.stripe_subscription_id),
      })).toBe(true);

      if (plan.role === 'platemaker') {
        expect(platemakerMayEnter(row as never)).toBe(true);
        expect(buyerServiceFeePercent({
          role: 'platemaker',
          membershipTier: 'premium',
          baseAmount: 30,
        })).toBe(10);
      } else {
        expect(buyerServiceFeePercent({
          role: 'platetaker',
          membershipTier: resolvedMembershipTier(row as never),
          baseAmount: 30,
        })).toBe(5);
        expect(buyerServiceFeePercent({
          role: 'platetaker',
          membershipTier: 'premium',
          baseAmount: 19.99,
        })).toBe(10);
        const home = finalPlateReceipt({
          totalPrice: 12,
          buyerRole: 'platetaker',
          buyerMembershipTier: 'premium',
          cardBase: 30,
        });
        const farm = finalPlateReceipt({
          totalPrice: 18,
          buyerRole: 'platetaker',
          buyerMembershipTier: 'premium',
          cardBase: 30,
        });
        expect(home.buyerFee).toBe(calculateFees(12, 5, 10).buyerFee);
        expect(farm.buyerFee).toBe(calculateFees(18, 5, 10).buyerFee);
        expect(Math.round((home.totalCharge + farm.totalCharge) * 100) / 100).toBe(
          Math.round((calculateFees(12, 5, 10).totalCharge + calculateFees(18, 5, 10).totalCharge) * 100) / 100,
        );
      }

      row.stripe_subscription_id = null;
      const dropped = await writeResolvedTier(tables, row as never);
      expect(dropped).toBe('free');
      expect(row.membership_tier).toBe('free');
      expect(clipPostAllowed({ role: plan.role, membershipTier: 'free' })).toBe(false);
      if (plan.role === 'platemaker') expect(platemakerMayEnter(row as never)).toBe(false);
      if (plan.role === 'platetaker') {
        expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'free', baseAmount: 30 })).toBe(10);
      }
    }

    expect(membershipProductName('platemaker', 'month')).toBe('HomeCookedPlate PlateMaker monthly');
    expect(membershipProductName('platemaker', 'year')).toBe('HomeCookedPlate PlateMaker yearly');
    expect(membershipProductName('platetaker', 'month')).toBe('HomeCookedPlate PlateTaker monthly');
    expect(membershipProductName('platetaker', 'year')).toBe('HomeCookedPlate PlateTaker yearly');
  });
});
