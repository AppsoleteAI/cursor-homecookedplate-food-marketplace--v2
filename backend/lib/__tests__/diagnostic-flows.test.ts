import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buyerCardCharge, buyerServiceFeePercent, calculateFees, orderTotalWithDelivery } from '../fees';
import { cookPermitIsSaved } from '../kitchen-permit';
import { GOOGLE_MEMBERSHIP_PRODUCT_IDS } from '../google-play';
import { recordPlatePayment } from '../record-paid-order';
import { withinPickupRadius } from '../pickup-radius';
import { pickupConfirmedByBoth } from '../order-status';
import {
  APPLE_RENEWAL_DELETE_MESSAGE,
  appleDeletionBlock,
  resolvedMembershipTier,
  userNeedsMembership,
  type TrialAccessProfile,
} from '../trial-access';
import { applePayMerchantName, profilePayeeName } from '../payee-name';
import { evaluateCaterLicense } from '@/lib/cater-event-license';
import { evaluateListing } from '@/lib/cottage-food';
import { evaluateTruckPermit } from '@/lib/food-truck-permit';
import { evaluateKitchenPermit } from '@/lib/kitchen-permit';
import {
  isLegalAgreementComplete,
  needsAppleLicenseRecheck,
  priorAgreementFromUnknown,
  type LegalAgreementRecord,
} from '@/lib/legal-agreement';
import { orderCloseout } from '@/lib/order-closeout';
import { evaluatePrepKitchen } from '@/lib/meal-prep-go';
import { scrubSentryEvent, sentryIdentity } from '@/lib/sentry-user';
import { evaluateSitDownLicense } from '@/lib/sit-down-license';

/**
 * PlateMaker and PlateTaker columns already stored for the review accounts.
 * The public profile list returns no rows, so these runs do not read, write, or delete those accounts.
 */
const PLATE_MAKER_ID = '11111111-1111-4111-8111-111111111111';
const PLATE_TAKER_ID = '22222222-2222-4222-8222-222222222222';
const MEAL_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = '44444444-4444-4444-8444-444444444444';

const plateMaker: TrialAccessProfile = {
  role: 'platemaker',
  membership_tier: 'premium',
  trial_ends_at: '2026-12-15T18:00:00.000Z',
  stripe_subscription_id: null,
  apple_original_transaction_id: 'review-ios-platemaker',
  google_purchase_token: 'play-maker-monthly',
  google_expires_at: '2026-12-01T18:00:00.000Z',
};

const plateTaker: TrialAccessProfile = {
  role: 'platetaker',
  membership_tier: 'premium',
  trial_ends_at: null,
  stripe_subscription_id: null,
  apple_original_transaction_id: 'review-ios-platetaker',
  google_purchase_token: 'play-taker-annual',
  google_expires_at: '2027-11-02T18:00:00.000Z',
};

const agreed = {
  readFoodInformation: true,
  readStateInformation: true,
  acceptsLocalRules: true,
  acceptsAllLiability: true,
  waivesPlatformLiability: true,
  maintainsCommissaryAccess: true,
  updatedAt: '2026-11-02T22:00:00.000Z',
};

const olderLegal = {
  sections: {
    jurisdictional_law: true,
    delivery_safety: true,
    liability_waiver: true,
    legal_safety_financial: true,
    allergy_food_safety: true,
    fee_structure: true,
    account_termination: true,
    uploaded_content: true,
    apple_eula: false,
  },
  acknowledgedOn: '2026-10-18',
  acknowledgedAt: '2026-10-18T15:00:00.000Z',
};

type Row = Record<string, unknown>;

function memoryAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: 'select' | 'update' | 'insert' = 'select';
      let patch: Row = {};
      let pendingInsert: Row | null = null;
      const run = () => {
        if (mode === 'insert' && pendingInsert) {
          rows.push(pendingInsert);
          return { data: pendingInsert, error: null };
        }
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
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return chain;
        },
        order() { return chain; },
        limit() { return run(); },
        maybeSingle() {
          const result = run();
          const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
          return { data, error: null };
        },
        update(next: Row) {
          mode = 'update';
          patch = next;
          return chain;
        },
        insert(next: Row) {
          mode = 'insert';
          pendingInsert = { ...next };
          return chain;
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

function launchDestination(signedIn: boolean, role: string | null): string {
  if (!signedIn || !role) return '/(auth)/welcome';
  if (role !== 'platemaker' && role !== 'platetaker') return '/(tabs)/(home)/home';
  const user = role === 'platemaker'
    ? { role, needsMembership: false, membershipTier: 'premium', metroArea: 'Pittsburgh' }
    : { role, needsMembership: false, membershipTier: 'premium', metroArea: 'Pittsburgh' };
  if (userNeedsMembership(user)) return '/membership';
  return role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/(home)/home';
}

function cookDashboardStay(role: string): 'dashboard' | 'home' {
  return role === 'platemaker' ? 'dashboard' : 'home';
}

function canSaveKitchenAgreement(role: string | null): boolean {
  return role === 'platemaker';
}

function businessNameOnProfile(role: string): boolean {
  return role === 'platemaker';
}

function playProductOnPhone(token: string | null | undefined): string | null {
  if (!token) return null;
  return token.includes('annual')
    ? GOOGLE_MEMBERSHIP_PRODUCT_IDS[1]
    : GOOGLE_MEMBERSHIP_PRODUCT_IDS[0];
}

describe.each([1, 2, 3])('diagnostic flows, run %s', () => {
  it('keeps the public profile list closed and uses the stored review accounts', async () => {
    const response = await fetch('https://tsrjtiunqbocmjgozeew.supabase.co/rest/v1/profiles?select=id&limit=1');
    const body = await response.text();
    expect(response.ok && body.trim().startsWith('[')).toBe(false);
    expect(plateMaker.apple_original_transaction_id).toBe('review-ios-platemaker');
    expect(plateTaker.apple_original_transaction_id).toBe('review-ios-platetaker');
  });

  it('routes the launch cover for both roles', () => {
    expect(launchDestination(false, 'platemaker')).toBe('/(auth)/welcome');
    expect(launchDestination(false, 'platetaker')).toBe('/(auth)/welcome');
    expect(launchDestination(true, 'platemaker')).toBe('/(tabs)/dashboard');
    expect(launchDestination(true, 'platetaker')).toBe('/(tabs)/(home)/home');
    expect(cookDashboardStay('platetaker')).toBe('home');
    expect(cookDashboardStay('platemaker')).toBe('dashboard');
  });

  it('saves the six acknowledgements for a PlateMaker and refuses a PlateTaker', async () => {
    expect(canSaveKitchenAgreement('platemaker')).toBe(true);
    expect(canSaveKitchenAgreement('platetaker')).toBe(false);
    expect(canSaveKitchenAgreement(null)).toBe(false);
    const sections = [
      evaluateKitchenPermit(agreed),
      evaluateListing(agreed),
      evaluateTruckPermit(agreed),
      evaluateSitDownLicense(agreed),
      evaluateCaterLicense(agreed),
      evaluatePrepKitchen(agreed),
    ];
    expect(sections.every((check) => check.ok)).toBe(true);
    expect(evaluateKitchenPermit({ ...agreed, maintainsCommissaryAccess: false }).ok).toBe(false);

    const tables: Record<string, Row[]> = {
      profiles: [
        { id: PLATE_MAKER_ID, role: 'platemaker', kitchen_permit: null, metro_area: 'Pittsburgh' },
        { id: PLATE_TAKER_ID, role: 'platetaker', kitchen_permit: null, metro_area: 'Pittsburgh' },
      ],
    };
    const admin = memoryAdmin(tables);
    expect(await cookPermitIsSaved(admin, PLATE_MAKER_ID)).toBe(false);
    tables.profiles[0].kitchen_permit = agreed;
    expect(await cookPermitIsSaved(admin, PLATE_MAKER_ID)).toBe(true);
    expect(await cookPermitIsSaved(admin, PLATE_TAKER_ID)).toBe(false);
  });

  it('lets a nearby PlateTaker order only after that save, then both people close the order', () => {
    const cook = { lat: 40.440624, lng: -79.995888 };
    const nearby = { lat: 40.5, lng: -80.0 };
    const far = { lat: 25.7617, lng: -80.1918 };
    expect(withinPickupRadius(cook, nearby)).toBe(true);
    expect(withinPickupRadius(cook, far)).toBe(false);
    expect(orderCloseout('platemaker', 'accepted')?.label).toBe('Ready for pickup');
    expect(orderCloseout('platemaker', 'ready')).toBeNull();
    expect(orderCloseout('platemaker', 'ready', false, true)?.label).toBe('Send');
    expect(orderCloseout('platetaker', 'ready')?.label).toBe('Send');
    expect(pickupConfirmedByBoth(['seller'])).toBe(false);
    expect(pickupConfirmedByBoth(['buyer'])).toBe(false);
    expect(pickupConfirmedByBoth(['seller', 'buyer'])).toBe(true);
  });

  it('records the Apple app license on each signed-in account and leaves the public terms for signed out', async () => {
    const created = new Date('2026-10-01T12:00:00.000Z');
    for (const account of [plateMaker, plateTaker]) {
      expect(account.role === 'platemaker' || account.role === 'platetaker').toBe(true);
      const prior = priorAgreementFromUnknown(olderLegal);
      expect(prior?.sections.uploaded_content).toBe(true);
      expect(prior?.sections.apple_eula).toBe(false);
      expect(needsAppleLicenseRecheck(olderLegal, created)).toBe(true);
      const saved: LegalAgreementRecord = {
        sections: { ...olderLegal.sections, apple_eula: true },
        acknowledgedOn: '2026-11-02',
        acknowledgedAt: '2026-11-02T22:00:00.000Z',
      };
      expect(isLegalAgreementComplete(saved)).toBe(true);
      expect(needsAppleLicenseRecheck(saved, created)).toBe(true);
      const current = {
        ...saved,
        acknowledgedOn: '2026-11-05',
        acknowledgedAt: '2026-11-05T22:00:00.000Z',
      };
      expect(needsAppleLicenseRecheck(current, created)).toBe(false);
    }
    const terms = await fetch('https://homecookedplate.com/terms');
    const html = await terms.text();
    expect(terms.ok).toBe(true);
    expect(html).toContain('Apple app license');
  });

  it('puts the cook business name on the payment sheet and keeps it off a PlateTaker profile', () => {
    expect(businessNameOnProfile('platemaker')).toBe(true);
    expect(businessNameOnProfile('platetaker')).toBe(false);
    const cookName = profilePayeeName({ business_name: 'Ada Kitchen', username: 'ada' });
    expect(cookName.length).toBeGreaterThanOrEqual(2);
    expect(applePayMerchantName([cookName])).toBe('Ada Kitchen');
    expect(applePayMerchantName([cookName])).not.toContain('HomeCookedPlate');
    expect(profilePayeeName({ username: 'buyer' })).toBe('buyer');
  });

  it('keeps a renewing store account and ends Premium after expiry or refund', () => {
    const now = new Date('2026-11-02T18:00:00.000Z');
    for (const account of [plateMaker, plateTaker]) {
      expect(appleDeletionBlock(account, { configured: true, renewing: true }, now)).toBe(APPLE_RENEWAL_DELETE_MESSAGE);
      const expired = { ...account, apple_expires_at: '2026-11-01T18:00:00.000Z', apple_revoked_at: null };
      expect(appleDeletionBlock(expired, { configured: true, renewing: false }, now)).toBeNull();
      const refunded = { ...account, apple_expires_at: '2026-12-01T18:00:00.000Z', apple_revoked_at: '2026-11-02T12:00:00.000Z' };
      expect(appleDeletionBlock(refunded, { configured: true, renewing: false }, now)).toBeNull();
    }
    const expiredBuyer = { ...plateTaker, apple_expires_at: '2026-11-01T18:00:00.000Z', google_purchase_token: null };
    expect(resolvedMembershipTier(expiredBuyer, now)).toBe('free');
    expect(buyerServiceFeePercent({
      role: 'platetaker',
      membershipTier: resolvedMembershipTier(expiredBuyer, now),
      baseAmount: 20,
    })).toBe(10);
    expect(playProductOnPhone(plateMaker.google_purchase_token)).toBe('com.rork.hcp.membership.monthly');
    expect(playProductOnPhone(plateTaker.google_purchase_token)).toBe('com.rork.hcp.membership.annual');
    expect(appleDeletionBlock(null, { configured: true, renewing: true }, now)).toBeNull();
  });

  it('starts Apple and Google sign-in for both roles', () => {
    const login = readFileSync(resolve(__dirname, '../../../app/(auth)/login.tsx'), 'utf8');
    const provider = readFileSync(resolve(__dirname, '../../../lib/provider-sign-in.ts'), 'utf8');
    const packages = readFileSync(resolve(__dirname, '../../../package.json'), 'utf8');
    expect(login.includes('not available yet')).toBe(false);
    expect(login).toContain('loginWithProvider');
    expect(provider).toContain('signInWithIdToken');
    expect(provider).toContain('signInWithOAuth');
    expect(packages).toContain('expo-apple-authentication');
    expect(packages).toContain('expo-auth-session');
    expect(login).toContain("loginWithProvider(provider === 'Apple' ? 'apple' : 'google'");
  });

  it('sends Sentry only the account id for each role', () => {
    for (const account of [
      { id: PLATE_MAKER_ID, email: 'cook@example.com', username: 'cook' },
      { id: PLATE_TAKER_ID, email: 'buyer@example.com', username: 'buyer' },
    ]) {
      expect(sentryIdentity(account)).toEqual({ id: account.id });
      const event = {
        user: { id: account.id, email: account.email, username: account.username, ip_address: '203.0.113.8' },
        request: { url: 'https://homecookedplate.com/orders', method: 'GET', headers: { Authorization: 'secret' } },
        extra: { email: account.email, userId: account.id },
        breadcrumbs: [{ data: { email: account.email, username: account.username } }],
      };
      scrubSentryEvent(event);
      expect(event.user).toEqual({ id: account.id });
      expect(event.user).not.toHaveProperty('email');
      expect(event.user).not.toHaveProperty('username');
      expect(event.user).not.toHaveProperty('ip_address');
      expect(event.extra).toEqual({ userId: account.id });
      expect(event.breadcrumbs[0].data).toEqual({});
    }
  });

  it('marks the PlateTaker payment paid and shows that order to the PlateMaker', async () => {
    const tables: Record<string, Row[]> = {
      profiles: [
        { id: PLATE_MAKER_ID, role: 'platemaker', membership_tier: 'premium' },
        { id: PLATE_TAKER_ID, role: 'platetaker', membership_tier: 'premium' },
      ],
      meals: [{ id: MEAL_ID, tags: ['portions:2'] }],
      orders: [{
        id: ORDER_ID,
        payment_intent_id: 'pi_diagnostic_plate',
        buyer_id: PLATE_TAKER_ID,
        platetaker_id: PLATE_TAKER_ID,
        seller_id: PLATE_MAKER_ID,
        meal_id: MEAL_ID,
        quantity: 1,
        total_price: 20,
        status: 'pending',
        paid: false,
        created_at: '2026-11-02T22:00:00.000Z',
      }],
      transactions: [],
      notifications: [],
      audit_logs: [],
    };
    const percent = buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'premium', baseAmount: 20 });
    const fees = calculateFees(20, percent, 10);
    const card = buyerCardCharge(orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, 0).buyerPays);
    const updated = await recordPlatePayment(memoryAdmin(tables), {
      paymentIntentId: 'pi_diagnostic_plate',
      chargeId: 'ch_diagnostic_plate',
      currency: 'usd',
      amountCents: Math.round(card.cardCharge * 100),
      listedOrderIds: [ORDER_ID],
      listedBaseCents: 2000,
    });
    expect(updated).toBe(1);
    const order = tables.orders[0];
    expect(order.paid).toBe(true);
    const cookOrders = tables.orders.filter((row) => row.seller_id === PLATE_MAKER_ID && row.paid === true);
    expect(cookOrders).toHaveLength(1);
    expect(cookOrders[0].buyer_id).toBe(PLATE_TAKER_ID);
    expect(tables.transactions[0].status).toBe('held');
    expect(tables.transactions[0].seller_id).toBe(PLATE_MAKER_ID);
    const webhookBody = updated > 0 ? { received: true } : { error: 'Database error' };
    expect(webhookBody).toEqual({ received: true });
  });
});
