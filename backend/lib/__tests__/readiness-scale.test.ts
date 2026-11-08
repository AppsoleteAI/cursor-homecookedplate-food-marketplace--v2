import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notifyCookOfPayment, notifyParty, ORDER_STEP_NOTICES, paymentReceivedNotice, readNoticePrefs } from '../account-notice';
import { sendNoticeEmail } from '../email';
import { buyerCardCharge, buyerServiceFeePercent, calculateFees, calculateOrderSplit, orderTotalWithDelivery, sellerRefundAmount } from '../fees';
import { cookPermitIsSaved, countPermittedMealsWithMedia } from '../kitchen-permit';
import { cookPayoutReady, payoutReleaseAt } from '../payout-policy';
import { hasMapPin, withinPickupRadius } from '../pickup-radius';
import { pickupConfirmedByBoth } from '../order-status';
import { recordPlatePayment } from '../record-paid-order';
import { releaseDuePayouts } from '../stripe-marketplace';
import {
  dailyRequestRoom,
  MAIL_PER_PAID_ORDER,
  orderMailFits,
  SCALE_DAILY_BUYERS,
  SCALE_DAILY_COOKS,
  SHARED_DAILY_EMAIL_CAP,
  SHARED_DAILY_REQUEST_CAP,
} from '../request-budget';

jest.mock('../email', () => ({
  sendNoticeEmail: jest.fn(async () => true),
}));

const mail = sendNoticeEmail as jest.MockedFunction<typeof sendNoticeEmail>;

const PLATE_MAKER_ID = '11111111-1111-4111-8111-111111111111';
const PLATE_TAKER_ID = '22222222-2222-4222-8222-222222222222';
const MEAL_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = '44444444-4444-4444-8444-444444444444';

const agreed = {
  readFoodInformation: true,
  readStateInformation: true,
  acceptsLocalRules: true,
  acceptsAllLiability: true,
  waivesPlatformLiability: true,
  maintainsCommissaryAccess: true,
  updatedAt: '2026-11-05T04:00:00.000Z',
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
        lte(key: string, value: unknown) {
          filters.push((row) => String(row[key] ?? '') <= String(value));
          return chain;
        },
        is(key: string, value: unknown) {
          filters.push((row) => (value === null ? row[key] == null : row[key] === value));
          return chain;
        },
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return chain;
        },
        or() { return chain; },
        order() { return chain; },
        limit() { return run(); },
        maybeSingle() {
          const result = run();
          const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
          return { data, error: null };
        },
        single() {
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

describe.each([1, 2, 3])('readiness at 5,000 a day, run %s', () => {
  beforeEach(() => {
    mail.mockClear();
  });

  it('keeps publishing, GPS, incoming paid orders, and two-person pickup on the cook', async () => {
    const agreementScreen = readFileSync(resolve(__dirname, '../../../app/kitchen-permit.tsx'), 'utf8');
    const publish = readFileSync(resolve(__dirname, '../../../backend/trpc/routes/meals/create/route.ts'), 'utf8');
    expect(agreementScreen).toContain('Home kitchen agreement');
    expect(publish).toContain('Save the home-kitchen agreement before a cooked plate goes on the menu.');
    expect(publish).toContain('Get GPS before a plate goes on the menu.');
    expect(hasMapPin(null)).toBe(false);
    expect(hasMapPin({ lat: 40.440624, lng: -79.995888 })).toBe(true);

    const cook = { lat: 40.440624, lng: -79.995888 };
    expect(withinPickupRadius(cook, { lat: 40.5, lng: -80.0 })).toBe(true);
    expect(withinPickupRadius(cook, { lat: 25.7617, lng: -80.1918 })).toBe(false);

    const tables: Record<string, Row[]> = {
      profiles: [
        { id: PLATE_MAKER_ID, role: 'platemaker', email: 'cook@example.com', kitchen_permit: null, metro_area: 'Pittsburgh' },
        { id: PLATE_TAKER_ID, role: 'platetaker', email: 'buyer@example.com', membership_tier: 'premium', kitchen_permit: null, metro_area: 'Pittsburgh' },
      ],
      meals: [{ id: MEAL_ID, user_id: PLATE_MAKER_ID, tags: ['portions:2'], images: ['plate.jpg'], published: true }],
    };
    const admin = memoryAdmin(tables);
    expect(await cookPermitIsSaved(admin, PLATE_MAKER_ID)).toBe(false);
    expect(await countPermittedMealsWithMedia(admin, 'Pittsburgh')).toBe(0);
    tables.profiles[0].kitchen_permit = agreed;
    expect(await cookPermitIsSaved(admin, PLATE_MAKER_ID)).toBe(true);
    expect(await cookPermitIsSaved(admin, PLATE_TAKER_ID)).toBe(false);
    expect(await countPermittedMealsWithMedia(admin, 'Pittsburgh')).toBe(1);

    tables.orders = [{
      id: ORDER_ID,
      payment_intent_id: 'pi_scale_plate',
      buyer_id: PLATE_TAKER_ID,
      seller_id: PLATE_MAKER_ID,
      meal_id: MEAL_ID,
      quantity: 1,
      total_price: 20,
      status: 'pending',
      paid: false,
      created_at: '2026-11-05T04:00:00.000Z',
    }];
    const percent = buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'premium', baseAmount: 20 });
    const fees = calculateFees(20, percent, 10);
    const withDelivery = orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, 0);
    const card = buyerCardCharge(withDelivery.buyerPays);
    const updated = await recordPlatePayment(admin, {
      paymentIntentId: 'pi_scale_plate',
      chargeId: 'ch_scale_plate',
      currency: 'usd',
      amountCents: Math.round(card.cardCharge * 100),
      listedOrderIds: [ORDER_ID],
      listedBaseCents: 2000,
    });
    expect(updated).toBe(1);
    const incoming = tables.orders.filter((row) => row.seller_id === PLATE_MAKER_ID && row.paid === true);
    expect(incoming).toHaveLength(1);
    expect(tables.transactions[0].status).toBe('held');
    expect(tables.transactions[0].payout_release_at).toBeNull();
    expect(mail).toHaveBeenCalledWith('cook@example.com', 'Payment received', paymentReceivedNotice(withDelivery.buyerPays).body);
    expect(pickupConfirmedByBoth(['seller'])).toBe(false);
    expect(pickupConfirmedByBoth(['buyer', 'seller'])).toBe(true);
  });

  it('shares one request day between 5,000 cooks and 5,000 buyers', () => {
    expect(SCALE_DAILY_COOKS).toBe(5_000);
    expect(SCALE_DAILY_BUYERS).toBe(5_000);
    expect(SCALE_DAILY_COOKS * SHARED_DAILY_REQUEST_CAP).toBeGreaterThan(SHARED_DAILY_REQUEST_CAP);
    expect(dailyRequestRoom({ kitchen: 40_000, homeAndCheckout: 40_000, other: 20_000 })).toBe(0);
    expect(dailyRequestRoom({ kitchen: 1, homeAndCheckout: 1, other: 0 })).toBe(SHARED_DAILY_REQUEST_CAP - 2);
    expect(orderMailFits(0)).toBe(true);
    expect(orderMailFits(SHARED_DAILY_EMAIL_CAP / MAIL_PER_PAID_ORDER)).toBe(true);
    expect(orderMailFits(SCALE_DAILY_COOKS)).toBe(false);
    expect(orderMailFits(SCALE_DAILY_BUYERS)).toBe(false);
  });

  it('sends accept, ready, and pickup mail to the buyer by default', async () => {
    const readyRoute = readFileSync(resolve(__dirname, '../../../backend/trpc/routes/platemaker/mark-as-ready/route.ts'), 'utf8');
    const acceptRoute = readFileSync(resolve(__dirname, '../../../backend/trpc/routes/platemaker/accept-order/route.ts'), 'utf8');
    const statusRoute = readFileSync(resolve(__dirname, '../../../backend/trpc/routes/orders/update-status/route.ts'), 'utf8');
    expect(readyRoute).toContain('ORDER_STEP_NOTICES.ready');
    expect(acceptRoute).toContain('ORDER_STEP_NOTICES.accepted');
    expect(statusRoute).toContain('ORDER_STEP_NOTICES.pickedUp');
    expect(statusRoute).toContain('ORDER_STEP_NOTICES.confirmPickup');

    const home = readFileSync(resolve(__dirname, '../../../app/(tabs)/(home)/home.tsx'), 'utf8');
    const cart = readFileSync(resolve(__dirname, '../../../app/(tabs)/cart.tsx'), 'utf8');
    const checkout = readFileSync(resolve(__dirname, '../../../app/checkout.tsx'), 'utf8');
    expect(home).toContain('metroArea');
    expect(cart.length).toBeGreaterThan(0);
    expect(checkout.length).toBeGreaterThan(0);

    const tables: Record<string, Row[]> = {
      profiles: [{ id: PLATE_TAKER_ID, email: 'buyer@example.com' }],
      notifications: [],
      audit_logs: [],
    };
    const admin = memoryAdmin(tables);
    expect(await readNoticePrefs(admin, PLATE_TAKER_ID)).toMatchObject({
      orderUpdates: true,
      paymentAlerts: true,
      emailNotifications: true,
    });
    await notifyParty(admin, PLATE_TAKER_ID, 'orderUpdates', ORDER_STEP_NOTICES.accepted);
    await notifyParty(admin, PLATE_TAKER_ID, 'orderUpdates', ORDER_STEP_NOTICES.ready);
    await notifyParty(admin, PLATE_TAKER_ID, 'orderUpdates', ORDER_STEP_NOTICES.pickedUp);
    expect(mail.mock.calls.map((call) => call[2])).toEqual([
      ORDER_STEP_NOTICES.accepted.body,
      ORDER_STEP_NOTICES.ready.body,
      ORDER_STEP_NOTICES.pickedUp.body,
    ]);

    mail.mockClear();
    tables.audit_logs.push({
      user_id: PLATE_TAKER_ID,
      action: 'NOTIFICATION_PREFS',
      new_data: { emailNotifications: false, orderUpdates: true },
    });
    await notifyParty(admin, PLATE_TAKER_ID, 'orderUpdates', ORDER_STEP_NOTICES.ready);
    expect(mail).not.toHaveBeenCalled();
  });

  it('holds the cook payout until that cook finishes Stripe, and does not charge a live card', async () => {
    const split = calculateOrderSplit(20);
    expect(split).toMatchObject({ totalCaptured: 22, sellerPayout: 18, buyerFee: 2, sellerFee: 2, appRevenue: 4 });
    expect(sellerRefundAmount(20)).toBeCloseTo(18);
    expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'free', baseAmount: 20 })).toBe(10);
    expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'premium', baseAmount: 20 })).toBe(5);
    expect(payoutReleaseAt(new Date('2026-11-05T04:00:00.000Z'))).toBe('2026-11-12T04:00:00.000Z');
    expect(cookPayoutReady(null)).toBe(false);
    expect(cookPayoutReady({ stripe_account_id: null, selling_removed: false })).toBe(false);
    expect(cookPayoutReady({ stripe_account_id: 'acct_scale', selling_removed: false })).toBe(false);
    expect(cookPayoutReady({ stripe_account_id: 'acct_scale', selling_removed: true, stripe_payouts_enabled: true })).toBe(false);
    expect(cookPayoutReady({
      stripe_account_id: 'acct_scale',
      selling_removed: true,
      stripe_payouts_enabled: true,
      final_payout_at: '2020-01-01T00:00:00.000Z',
    })).toBe(true);
    expect(cookPayoutReady({ stripe_account_id: 'acct_scale', selling_removed: false, stripe_payouts_enabled: true })).toBe(true);

    const checkout = readFileSync(resolve(__dirname, '../../../backend/trpc/routes/payments/create-payment-intent/route.ts'), 'utf8');
    expect(checkout).toContain('Seller has not completed Stripe onboarding');
    expect(checkout).toContain('calculateFees');

    const tables: Record<string, Row[]> = {
      transactions: [{
        id: 'tx-scale',
        seller_id: PLATE_MAKER_ID,
        seller_payout: 18,
        currency: 'usd',
        payment_intent_id: 'pi_scale_held',
        order_id: ORDER_ID,
        status: 'held',
        payout_release_at: '2026-11-01T00:00:00.000Z',
        stripe_transfer_id: null,
        stripe_charge_id: 'ch_scale_held',
      }],
      profiles: [{ id: PLATE_MAKER_ID, stripe_account_id: null, selling_removed: false }],
    };
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await releaseDuePayouts(memoryAdmin(tables) as never, 'sk_test_scale');
    expect(result).toEqual({ released: 0, skipped: 1 });
    expect(tables.transactions[0].status).toBe('held');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(mail).not.toHaveBeenCalled();
  });

  it('does not email a paid order when the cook id is missing', async () => {
    const admin = memoryAdmin({ profiles: [], notifications: [], audit_logs: [] });
    await notifyCookOfPayment(admin, null, 22);
    await notifyCookOfPayment(admin, PLATE_MAKER_ID, 0);
    expect(mail).not.toHaveBeenCalled();
  });
});
