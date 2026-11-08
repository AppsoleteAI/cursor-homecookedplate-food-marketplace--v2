import { appRouter } from '../../trpc/app-router';
import { notifyCookOfPayment, paymentReceivedNotice } from '../account-notice';
import { buyerCardCharge, calculateFees } from '../fees';
import { buyerMetroCanOrder } from '../metro-menu';
import { METRO_CENTERS } from '../metro-radius';
import { recordPlatePayment } from '../record-paid-order';
import {
  COTTAGE_GUIDANCE,
  FOUR_AREA_MEALS,
  SIX_AREA_MEALS,
  cookMayList,
  cottageDirectoryRestrictsListing,
  cottageFoodGuidance,
  cottageLaw,
  purchaseEachArea,
  purchaseMultipleFromTwoAreas,
  purchaseTwoAreas,
  receiptAmountForRole,
} from '../state-meal-plan';
import { messageNotice, paidContactDecision } from '@/lib/order-contact';
import { SIGNED_LEGAL_RECORD } from '../legal-gate';

const ON_FILE = {
  legal_safety_agreement: SIGNED_LEGAL_RECORD,
  created_at: '2026-01-01T00:00:00.000Z',
};

jest.mock('../email', () => ({
  sendNoticeEmail: jest.fn(async () => true),
}));

const COOK = '11111111-1111-4111-8111-111111111111';
const BUYER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '55555555-5555-4555-8555-555555555555';
const MEAL = '33333333-3333-4333-8333-333333333333';
const ORDER = '44444444-4444-4444-8444-444444444444';

type Row = Record<string, unknown>;

function memoryAdmin(tables: Record<string, Row[]>) {
  let sequence = 0;
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: 'select' | 'update' | 'insert' | 'delete' = 'select';
      let patch: Row = {};
      let pendingInsert: Row | null = null;
      let sortKey = '';
      let sortAsc = true;
      const run = () => {
        if (mode === 'insert' && pendingInsert) {
          sequence += 1;
          const saved = {
            id: `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
            created_at: '2026-11-06T00:00:00.000Z',
            ...pendingInsert,
          };
          pendingInsert = null;
          rows.push(saved);
          return { data: saved, error: null };
        }
        const matched = rows.filter((row) => filters.every((fn) => fn(row)));
        if (sortKey) {
          matched.sort((a, b) => {
            const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
            return sortAsc ? cmp : -cmp;
          });
        }
        if (mode === 'delete') {
          for (const row of matched) {
            const index = rows.indexOf(row);
            if (index >= 0) rows.splice(index, 1);
          }
          return { data: matched, error: null };
        }
        if (mode === 'update') {
          for (const row of matched) Object.assign(row, patch);
        }
        return { data: matched, error: null };
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
        or() { return chain; },
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return chain;
        },
        gte(key: string, value: unknown) {
          filters.push((row) => String(row[key] ?? '') >= String(value));
          return chain;
        },
        is(key: string, value: unknown) {
          filters.push((row) => (value === null ? row[key] == null : row[key] === value));
          return chain;
        },
        order(key: string, options?: { ascending?: boolean }) {
          sortKey = key;
          sortAsc = options?.ascending !== false;
          return chain;
        },
        limit() { return run(); },
        maybeSingle() { return one(false); },
        single() { return one(true); },
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
        delete() {
          mode = 'delete';
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

const RUNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe.each(RUNS)('six areas, run %s', () => {
  it('lists six meals in six areas at six prices', () => {
    expect(cottageDirectoryRestrictsListing()).toBe(false);
    expect(SIX_AREA_MEALS).toHaveLength(6);
    expect(new Set(SIX_AREA_MEALS.map((meal) => meal.area)).size).toBe(6);
    expect(new Set(SIX_AREA_MEALS.map((meal) => meal.price)).size).toBe(6);
    expect(new Set(SIX_AREA_MEALS.map((meal) => meal.sellerId)).size).toBe(6);
    for (const meal of SIX_AREA_MEALS) {
      expect(METRO_CENTERS.some((metro) => metro.name === meal.metro)).toBe(true);
      expect(meal.price).toBeGreaterThan(0);
    }
    expect(SIX_AREA_MEALS[0].metro).toBe(SIX_AREA_MEALS[1].metro);
    expect(cookMayList('platemaker')).toBe(true);
    expect(cookMayList('platetaker')).toBe(false);
    expect(cookMayList(null)).toBe(false);
  });

  it('finds the cottage directory row and does not use it as a listing rule', () => {
    for (const meal of SIX_AREA_MEALS) {
      const law = cottageLaw(meal.stateCode);
      expect(law?.state).toBe(meal.state);
      expect(law?.band).not.toBe('none');
      expect(law?.bandLabel.length).toBeGreaterThan(0);
      const guidance = cottageFoodGuidance(meal.stateCode);
      expect(guidance.state).toBe(meal.state);
      expect(guidance.note.startsWith(COTTAGE_GUIDANCE)).toBe(true);
      expect(guidance.note).toMatch(/local municipality/);
      expect(guidance.note).toMatch(/does not require the food to fit/);
    }
    expect(cottageLaw('ZZ')).toBeNull();
    const california = cottageFoodGuidance('CA').note;
    expect(california).toContain(COTTAGE_GUIDANCE);
    expect(california).not.toMatch(/cannot|refused|not allowed/i);
    expect(cottageFoodGuidance('NY').note).toMatch(/pumpkin/i);
    expect(cottageFoodGuidance('HI').note).toContain(COTTAGE_GUIDANCE);
    expect(cottageFoodGuidance('ZZ').state).toBeNull();
    expect(cottageFoodGuidance('ZZ').note).toContain('not in the cottage directory');
  });

  it('sells one meal from each area and several items from two areas', () => {
    const separate = purchaseEachArea();
    expect(separate.map((checkout) => checkout.area)).toEqual([
      'home', 'farm', 'meal_prep', 'food_truck', 'food_cart', 'catering',
    ]);
    separate.forEach((checkout, index) => {
      const fees = calculateFees(SIX_AREA_MEALS[index].price, 10, 10);
      expect(checkout.buyerPays).toBe(fees.totalCharge);
      expect(checkout.sellerPayout).toBe(fees.sellerPayout);
      expect(receiptAmountForRole('platetaker', checkout).label).toBe('You pay');
      expect(receiptAmountForRole('platetaker', checkout).amount).toBe(fees.totalCharge);
      expect(receiptAmountForRole('platemaker', checkout).label).toBe('You receive');
      expect(receiptAmountForRole('platemaker', checkout).amount).toBe(fees.sellerPayout);
    });

    const several = purchaseMultipleFromTwoAreas();
    expect(several.checkouts.map((checkout) => checkout.area)).toEqual(['home', 'farm']);
    expect(several.checkouts.map((checkout) => checkout.lines[0].name)).toEqual(['Cheesecake', 'Pumpkin pie']);
    expect(several.checkouts[0].lines[0].quantity).toBe(1);
    expect(several.checkouts[1].lines[0].quantity).toBe(1);
    const home = calculateFees(12, 10, 10);
    const farm = calculateFees(18, 10, 10);
    expect(several.combinedBase).toBe(30);
    expect(several.combinedBuyerPays).toBe(Math.round((home.totalCharge + farm.totalCharge) * 100) / 100);
    expect(several.combinedSellerPayout).toBe(Math.round((home.sellerPayout + farm.sellerPayout) * 100) / 100);
    expect(several.checkouts[0].sellerPayout).toBe(home.sellerPayout);
    expect(several.checkouts[1].buyerPays).toBe(farm.totalCharge);

    const card = purchaseTwoAreas();
    expect(card.checkouts.map((checkout) => checkout.area)).toEqual(['home', 'farm']);
    expect(card.combinedBase).toBe(30);
    expect(card.combinedBuyerPays).toBe(several.combinedBuyerPays);

    const premium = purchaseMultipleFromTwoAreas(SIX_AREA_MEALS.slice(0, 2), [1, 1], {
      buyerRole: 'platetaker',
      buyerMembershipTier: 'premium',
    });
    const premiumHome = calculateFees(12, 5, 10);
    const premiumFarm = calculateFees(18, 5, 10);
    expect(premium.combinedBuyerPays).toBe(Math.round((premiumHome.totalCharge + premiumFarm.totalCharge) * 100) / 100);
    expect(premium.checkouts[0].sellerPayout).toBe(premiumHome.sellerPayout);

    expect(buyerMetroCanOrder(SIX_AREA_MEALS[0].metro, SIX_AREA_MEALS[1].metro)).toBe(true);
    expect(buyerMetroCanOrder(SIX_AREA_MEALS[0].metro, SIX_AREA_MEALS[2].metro)).toBe(false);
    expect(FOUR_AREA_MEALS).toHaveLength(4);
  });

  it('lets the buyer write the cook only after the order is paid', () => {
    expect(paidContactDecision({ paid: false, role: 'platetaker', text: 'Is this ready?' }).ok).toBe(false);
    expect(paidContactDecision({ paid: false, role: 'platemaker', text: 'On the way' }).ok).toBe(false);
    const paid = paidContactDecision({ paid: true, role: 'platetaker', text: 'I paid. See you at pickup.' });
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.text).toBe('I paid. See you at pickup.');
    expect(paidContactDecision({ paid: true, role: 'guest', text: 'hello' }).ok).toBe(false);
    expect(paymentReceivedNotice(22).title).toBe('Payment received');
    expect(messageNotice('I paid. See you at pickup.').title).toBe('New message');
  });

  it('lets the cook send an ETA and keeps the buyer from sending one', () => {
    const eta = paidContactDecision({ paid: true, role: 'platemaker', etaMinutes: 25, text: '' });
    expect(eta.ok).toBe(true);
    if (eta.ok) {
      expect(eta.text).toBe('ETA 25 minutes.');
      expect(messageNotice(eta.text).title).toBe('Order ETA');
    }
    expect(paidContactDecision({ paid: true, role: 'platetaker', etaMinutes: 25, text: '' }).ok).toBe(false);
    expect(paidContactDecision({ paid: false, role: 'platemaker', etaMinutes: 25, text: '' }).ok).toBe(false);
    expect(paidContactDecision({ paid: true, role: 'platemaker', etaMinutes: 4, text: '' }).ok).toBe(false);
  });
});

describe.each(RUNS)('paid contact and final receipt, run %s', () => {
  function db(status: string, paid: boolean, tier: Row = {}) {
    return memoryAdmin({
      profiles: [
        { id: COOK, role: 'platemaker', is_paused: false, email: 'cook@example.com', membership_tier: 'free', ...ON_FILE },
        { id: BUYER, role: 'platetaker', is_paused: false, email: 'buyer@example.com', membership_tier: 'free', ...ON_FILE, ...tier },
        { id: STRANGER, role: 'platetaker', is_paused: false, email: 'other@example.com', ...ON_FILE },
      ],
      meals: [{ id: MEAL, name: 'Cheesecake' }],
      orders: [{
        id: ORDER,
        buyer_id: BUYER,
        seller_id: COOK,
        meal_id: MEAL,
        quantity: 1,
        total_price: 22,
        status,
        paid,
      }],
      order_messages: [],
      notifications: [],
      audit_logs: [],
    });
  }

  it('refuses an unpaid message and stores a paid message and an ETA', async () => {
    const unpaid = db('pending', false);
    await expect(caller(BUYER, unpaid).messages.send({ orderId: ORDER, text: 'Paid?' })).rejects.toMatchObject({
      message: 'Pay for this order before sending a message.',
    });
    const quiet = await unpaid.from('order_messages').select();
    expect(quiet.data).toEqual([]);

    const paid = db('accepted', true);
    const sent = await caller(BUYER, paid).messages.send({ orderId: ORDER, text: 'I paid. See you at pickup.' });
    expect(sent.text).toBe('I paid. See you at pickup.');
    expect(sent.senderRole).toBe('platetaker');
    expect(sent.moderationStatus).toBe('pending');

    const eta = await caller(COOK, paid).messages.send({ orderId: ORDER, text: '', etaMinutes: 25 });
    expect(eta.text).toBe('ETA 25 minutes.');
    expect(eta.senderRole).toBe('platemaker');
    await expect(caller(BUYER, paid).messages.send({ orderId: ORDER, text: '', etaMinutes: 25 })).rejects.toMatchObject({
      message: 'Only the PlateMaker can send an ETA.',
    });
    await expect(caller(null, paid, false).messages.send({ orderId: ORDER, text: 'hello' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(caller(STRANGER, paid).messages.send({ orderId: ORDER, text: 'hello' })).rejects.toMatchObject({
      message: 'You are not part of this order conversation',
    });
  });

  it('shows the final receipt to each role after both acknowledgements', async () => {
    const open = db('ready', true);
    await expect(caller(BUYER, open).orders.finalReceipt({ orderId: ORDER })).rejects.toMatchObject({
      message: 'The final receipt is ready after both people acknowledge the food was paid for and received.',
    });

    const done = db('completed', true);
    const buyer = await caller(BUYER, done).orders.finalReceipt({ orderId: ORDER });
    const fees = calculateFees(22, 10, 10);
    expect(buyer.role).toBe('platetaker');
    expect(buyer.viewerLabel).toBe('You pay');
    expect(buyer.viewerAmount).toBe(fees.totalCharge);
    expect(buyer.sellerPayout).toBe(fees.sellerPayout);
    expect(buyer.mealName).toBe('Cheesecake');

    const cook = await caller(COOK, done).orders.finalReceipt({ orderId: ORDER });
    expect(cook.role).toBe('platemaker');
    expect(cook.viewerLabel).toBe('You receive');
    expect(cook.viewerAmount).toBe(fees.sellerPayout);

    const premiumDb = db('completed', true, { stripe_subscription_id: 'sub_local', membership_tier: 'premium' });
    const premium = await caller(BUYER, premiumDb).orders.finalReceipt({ orderId: ORDER });
    const premiumFees = calculateFees(22, 5, 10);
    expect(premium.buyerPays).toBe(premiumFees.totalCharge);
    expect(premium.sellerPayout).toBe(premiumFees.sellerPayout);

    await expect(caller(STRANGER, done).orders.finalReceipt({ orderId: ORDER })).rejects.toMatchObject({
      message: 'You cannot view this receipt.',
    });
    await expect(caller(null, done, false).orders.finalReceipt({ orderId: ORDER })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('lets a cook list any food after naming a state, and still refuses a buyer', async () => {
    const agreed = {
      readFoodInformation: true,
      readStateInformation: true,
      acceptsLocalRules: true,
      acceptsAllLiability: true,
      waivesPlatformLiability: true,
      maintainsCommissaryAccess: true,
      updatedAt: '2026-11-06T00:00:00.000Z',
    };
    const tables = memoryAdmin({
      profiles: [
        {
          id: COOK,
          role: 'platemaker',
          is_paused: false,
          food_safety_acknowledged: true,
          membership_tier: 'lifetime',
          metro_area: 'Los Angeles-Long Beach-Anaheim',
          stripe_account_id: 'acct_local_not_real',
          stripe_payouts_enabled: true,
          kitchen_lat: 34.05,
          kitchen_lng: -118.24,
          kitchen_permit: agreed,
          ...ON_FILE,
        },
        { id: BUYER, role: 'platetaker', is_paused: false, ...ON_FILE },
      ],
      meals: [],
      audit_logs: [],
    });
    const plate = {
      description: 'Shelf-stable loaf',
      price: 12,
      images: ['loaf.jpg'],
      ingredients: ['flour'],
      cuisine: 'Bread',
      category: 'snack' as const,
      preparationTime: 30,
      stateCode: 'CA',
    };
    await expect(caller(BUYER, tables).meals.create({ ...plate, name: 'Sourdough loaf' })).rejects.toMatchObject({
      message: 'Only a PlateMaker can list a meal.',
    });
    const cheesecake = await caller(COOK, tables).meals.create({ ...plate, name: 'Cheesecake', stateCode: 'CA' });
    expect(cheesecake.name).toBe('Cheesecake');
    expect(cheesecake.stateGuidance).toContain('does not require the food to fit');
    const pumpkin = await caller(COOK, tables).meals.create({ ...plate, name: 'Pumpkin pie', stateCode: 'NY' });
    expect(pumpkin.name).toBe('Pumpkin pie');
    expect(pumpkin.stateGuidance).toMatch(/pumpkin/i);
    expect(cheesecake.published).toBe(false);
    expect(pumpkin.stateGuidance).not.toMatch(/cannot|refused|not allowed/i);
    const saved = await tables.from('meals').select();
    const rows = saved.data as Row[];
    expect(rows).toHaveLength(2);
    expect((rows[0].tags as string[]).includes('state:CA')).toBe(true);
    expect((rows[1].tags as string[]).includes('state:NY')).toBe(true);
  });

  it('tells the cook when a buyer pays', async () => {
    const tables = db('pending', true);
    await notifyCookOfPayment(tables, COOK, 22);
    const notes = tables.from('notifications');
    const saved = await notes.select().eq('user_id', COOK);
    const rows = saved.data as Row[];
    expect(rows.some((row) => row.title === 'Payment received')).toBe(true);
    await notifyCookOfPayment(tables, null, 22);
    await notifyCookOfPayment(tables, COOK, 0);
  });
});

const AREA_BUYERS = [
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203',
  '22222222-2222-4222-8222-222222222204',
  '22222222-2222-4222-8222-222222222205',
  '22222222-2222-4222-8222-222222222206',
];

const KITCHEN_AGREEMENT = {
  readFoodInformation: true,
  readStateInformation: true,
  acceptsLocalRules: true,
  acceptsAllLiability: true,
  waivesPlatformLiability: true,
  maintainsCommissaryAccess: true,
  updatedAt: '2026-11-06T00:00:00.000Z',
};

function metroPin(name: string) {
  const found = METRO_CENTERS.find((metro) => metro.name === name);
  if (!found) throw new Error(name);
  return found;
}

function cardCents(base: number): number {
  return Math.round(buyerCardCharge(calculateFees(base, 10, 10).totalCharge).cardCharge * 100);
}

describe.each(RUNS)('create, pay, message, and pick up, run %s', () => {
  const payments = new Map<string, number>();
  let fetchMock: { mockRestore: () => void };

  beforeEach(() => {
    payments.clear();
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const id = url.includes('/payment_intents/') ? url.split('/payment_intents/')[1] : '';
      const amount = payments.get(id);
      if (amount == null) {
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'succeeded', amount, metadata: {} }),
      } as Response;
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('covers six areas, two-area quantities, messages, Stripe, and pickup', async () => {
    const profiles = [
      ...SIX_AREA_MEALS.map((meal) => {
        const where = metroPin(meal.metro);
        return {
          id: meal.sellerId,
          role: 'platemaker',
          is_paused: false,
          email: `${meal.area}@example.com`,
          food_safety_acknowledged: true,
          membership_tier: 'lifetime',
          metro_area: meal.metro,
          stripe_account_id: 'acct_local_not_real',
          stripe_payouts_enabled: true,
          kitchen_lat: where.lat,
          kitchen_lng: where.lng,
          kitchen_permit: KITCHEN_AGREEMENT,
          available_for_orders: true,
          selling_removed: false,
          created_at: '2026-01-01T00:00:00.000Z',
          legal_safety_agreement: SIGNED_LEGAL_RECORD,
        };
      }),
      ...SIX_AREA_MEALS.map((meal, index) => {
        const where = metroPin(meal.metro);
        return {
          id: AREA_BUYERS[index],
          role: 'platetaker',
          is_paused: false,
          email: `buyer-${meal.area}@example.com`,
          membership_tier: 'free',
          metro_area: meal.metro,
          kitchen_lat: where.lat,
          kitchen_lng: where.lng,
          ordering_removed: false,
          created_at: '2026-01-01T00:00:00.000Z',
          legal_safety_agreement: SIGNED_LEGAL_RECORD,
        };
      }),
    ];
    const tables = memoryAdmin({
      profiles,
      meals: [],
      orders: [],
      transactions: [],
      notifications: [],
      order_messages: [],
      audit_logs: [],
      promotional_offers: [],
      platemaker_responsibility_events: [],
      cook_buyer_blocks: [],
    });
    const pickupTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const mealIds: string[] = [];
    for (const meal of SIX_AREA_MEALS) {
      const created = await caller(meal.sellerId, tables).meals.create({
        name: meal.name,
        description: 'A plate from this kitchen',
        price: meal.price,
        images: ['plate.jpg'],
        ingredients: ['food'],
        cuisine: 'Dinner',
        category: 'dinner',
        preparationTime: 30,
        portions: 10,
        stateCode: meal.stateCode,
      });
      expect(created.published).toBe(false);
      expect(created.stateGuidance).toContain('does not require the food to fit');
      expect(cottageDirectoryRestrictsListing()).toBe(false);
      await caller(meal.sellerId, tables).meals.updateDetails({
        mealId: created.id,
        cuisine: 'Dinner',
        ingredients: ['food'],
        expiryDate: '2026-12-01',
        portions: 10,
      });
      const saved = await tables.from('meals').select().eq('id', created.id);
      const row = (saved.data as Row[])[0];
      row.tags = [...(Array.isArray(row.tags) ? row.tags as string[] : []), `area:${meal.area}`];
      mealIds.push(created.id);
    }
    expect(mealIds).toHaveLength(6);

    await expect(caller(null, tables, false).meals.create({
      name: 'Cheesecake',
      description: 'A plate from this kitchen',
      price: 12,
      images: ['plate.jpg'],
      ingredients: ['food'],
      cuisine: 'Dinner',
      category: 'dinner',
      preparationTime: 30,
    })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller(AREA_BUYERS[0], tables).meals.create({
      name: 'Cheesecake',
      description: 'A plate from this kitchen',
      price: 12,
      images: ['plate.jpg'],
      ingredients: ['food'],
      cuisine: 'Dinner',
      category: 'dinner',
      preparationTime: 30,
      stateCode: 'CA',
    })).rejects.toMatchObject({ message: 'Only a PlateMaker can list a meal.' });

    const singles = [];
    for (let index = 0; index < SIX_AREA_MEALS.length; index += 1) {
      const placed = await caller(AREA_BUYERS[index], tables).orders.create({
        mealId: mealIds[index],
        sellerId: SIX_AREA_MEALS[index].sellerId,
        quantity: 1,
        unitPrice: SIX_AREA_MEALS[index].price,
        pickupTime,
      });
      expect(placed.paid).toBe(false);
      expect(placed.quantity).toBe(1);
      expect(placed.totalPrice).toBe(SIX_AREA_MEALS[index].price);
      singles.push(placed);
    }

    const multiHome = await caller(AREA_BUYERS[0], tables).orders.create({
      mealId: mealIds[0],
      sellerId: SIX_AREA_MEALS[0].sellerId,
      quantity: 1,
      unitPrice: 12,
      pickupTime,
    });
    const multiFarm = await caller(AREA_BUYERS[0], tables).orders.create({
      mealId: mealIds[1],
      sellerId: SIX_AREA_MEALS[1].sellerId,
      quantity: 1,
      unitPrice: 18,
      pickupTime,
    });
    expect(multiHome.totalPrice).toBe(12);
    expect(multiFarm.totalPrice).toBe(18);
    await expect(caller(AREA_BUYERS[0], tables).orders.create({
      mealId: mealIds[2],
      sellerId: SIX_AREA_MEALS[2].sellerId,
      quantity: 1,
      unitPrice: 9,
      pickupTime,
    })).rejects.toMatchObject({
      message: expect.stringMatching(/20 miles|outside your saved metro/),
    });
    await expect(caller(null, tables, false).orders.create({
      mealId: mealIds[0],
      sellerId: SIX_AREA_MEALS[0].sellerId,
      quantity: 1,
      unitPrice: 12,
      pickupTime,
    })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const unpaid = singles[3];
    await expect(caller(AREA_BUYERS[3], tables).messages.send({
      orderId: unpaid.id,
      text: 'Is this ready?',
    })).rejects.toMatchObject({ message: 'Pay for this order before sending a message.' });

    for (let index = 0; index < singles.length; index += 1) {
      const intent = `pi_local_single_${index}`;
      const cents = cardCents(SIX_AREA_MEALS[index].price);
      payments.set(intent, cents - 1);
      await expect(caller(AREA_BUYERS[index], tables).orders.updatePaymentIntent({
        orderIds: [singles[index].id],
        paymentIntentId: intent,
      })).rejects.toMatchObject({ message: 'That payment does not match these plate prices.' });
      payments.set(intent, cents);
      await caller(AREA_BUYERS[index], tables).orders.updatePaymentIntent({
        orderIds: [singles[index].id],
        paymentIntentId: intent,
      });
      expect(await recordPlatePayment(tables, { paymentIntentId: intent, amountCents: cents - 1, chargeId: `ch_short_${index}` })).toBe(0);
      expect(await recordPlatePayment(tables, { paymentIntentId: intent, amountCents: cents, chargeId: `ch_local_${index}` })).toBe(1);
    }

    const multiIntent = 'pi_local_two_areas';
    const multiCents = cardCents(30);
    payments.set(multiIntent, multiCents - 1);
    await expect(caller(AREA_BUYERS[0], tables).orders.updatePaymentIntent({
      orderIds: [multiHome.id, multiFarm.id],
      paymentIntentId: multiIntent,
    })).rejects.toMatchObject({ message: 'That payment does not match these plate prices.' });
    payments.set(multiIntent, multiCents);
    await caller(AREA_BUYERS[0], tables).orders.updatePaymentIntent({
      orderIds: [multiHome.id, multiFarm.id],
      paymentIntentId: multiIntent,
    });
    expect(await recordPlatePayment(tables, {
      paymentIntentId: multiIntent,
      amountCents: multiCents,
      chargeId: 'ch_local_two',
    })).toBe(2);

    const homeFees = calculateFees(12, 10, 10);
    const farmFees = calculateFees(18, 10, 10);
    const transactions = await tables.from('transactions').select();
    const multiRows = (transactions.data as Row[]).filter((row) => row.payment_intent_id === multiIntent);
    expect(multiRows).toHaveLength(2);
    const homeTx = multiRows.find((row) => row.order_id === multiHome.id);
    const farmTx = multiRows.find((row) => row.order_id === multiFarm.id);
    expect(homeTx?.buyer_payment).toBe(homeFees.totalCharge);
    expect(homeTx?.seller_payout).toBe(homeFees.sellerPayout);
    expect(homeTx?.status).toBe('held');
    expect(farmTx?.buyer_payment).toBe(farmFees.totalCharge);
    expect(farmTx?.seller_payout).toBe(farmFees.sellerPayout);

    const accepted = await caller(SIX_AREA_MEALS[0].sellerId, tables).platemaker.acceptOrder({ orderId: multiHome.id });
    expect(accepted.status).toBe('accepted');
    const buyerNote = await caller(AREA_BUYERS[0], tables).messages.send({
      orderId: multiHome.id,
      text: 'I am on my way.',
    });
    expect(buyerNote.senderRole).toBe('platetaker');
    expect(buyerNote.text).toBe('I am on my way.');
    const eta = await caller(SIX_AREA_MEALS[0].sellerId, tables).messages.send({
      orderId: multiHome.id,
      text: '',
      etaMinutes: 25,
    });
    expect(eta.senderRole).toBe('platemaker');
    expect(eta.text).toBe('ETA 25 minutes.');
    await expect(caller(AREA_BUYERS[0], tables).messages.send({
      orderId: multiHome.id,
      text: '',
      etaMinutes: 25,
    })).rejects.toMatchObject({ message: 'Only the PlateMaker can send an ETA.' });

    const ready = await caller(SIX_AREA_MEALS[0].sellerId, tables).orders.updateStatus({
      orderId: multiHome.id,
      status: 'ready',
    });
    expect(ready.status).toBe('ready');
    const atTheDoor = await caller(AREA_BUYERS[0], tables).messages.send({
      orderId: multiHome.id,
      text: 'I can see the kitchen.',
    });
    expect(atTheDoor.text).toBe('I can see the kitchen.');

    await expect(caller(SIX_AREA_MEALS[0].sellerId, tables).orders.updateStatus({
      orderId: multiHome.id,
      status: 'completed',
    })).rejects.toMatchObject({
      message: 'The PlateTaker has to acknowledge that the food was paid for and received before this order can be cleared.',
    });
    const waiting = await caller(AREA_BUYERS[0], tables).orders.updateStatus({
      orderId: multiHome.id,
      status: 'completed',
    });
    expect(waiting.waiting).toBe(true);
    expect(waiting.status).toBe('ready');
    const closed = await caller(SIX_AREA_MEALS[0].sellerId, tables).orders.updateStatus({
      orderId: multiHome.id,
      status: 'completed',
    });
    expect(closed.waiting).toBe(false);
    expect(closed.status).toBe('completed');

    const farmAccepted = await caller(SIX_AREA_MEALS[1].sellerId, tables).platemaker.acceptOrder({ orderId: multiFarm.id });
    expect(farmAccepted.status).toBe('accepted');
    const farmReady = await caller(SIX_AREA_MEALS[1].sellerId, tables).orders.updateStatus({
      orderId: multiFarm.id,
      status: 'ready',
    });
    expect(farmReady.status).toBe('ready');
    const farmWaiting = await caller(AREA_BUYERS[0], tables).orders.updateStatus({
      orderId: multiFarm.id,
      status: 'completed',
    });
    expect(farmWaiting.waiting).toBe(true);
    const farmClosed = await caller(SIX_AREA_MEALS[1].sellerId, tables).orders.updateStatus({
      orderId: multiFarm.id,
      status: 'completed',
    });
    expect(farmClosed.status).toBe('completed');

    const buyerNotes = await tables.from('notifications').select().eq('user_id', AREA_BUYERS[0]);
    expect((buyerNotes.data as Row[]).some((row) => row.body === 'This order was marked picked up.')).toBe(true);
    const cookNotes = await tables.from('notifications').select().eq('user_id', SIX_AREA_MEALS[0].sellerId);
    expect((cookNotes.data as Row[]).some((row) => row.title === 'Payment received')).toBe(true);
    const held = await tables.from('transactions').select().eq('order_id', multiHome.id);
    expect(typeof (held.data as Row[])[0].payout_release_at).toBe('string');

    const buyerReceipt = await caller(AREA_BUYERS[0], tables).orders.finalReceipt({ orderId: multiHome.id });
    expect(buyerReceipt.role).toBe('platetaker');
    expect(buyerReceipt.lines.map((line) => line.mealName)).toEqual(['Cheesecake', 'Pumpkin pie']);
    expect(buyerReceipt.lines.map((line) => line.quantity)).toEqual([1, 1]);
    expect(buyerReceipt.lines.map((line) => line.areaLabel)).toEqual(['Home plate', 'Farm']);
    expect(buyerReceipt.lines.map((line) => line.baseAmount)).toEqual([homeFees.baseAmount, farmFees.baseAmount]);
    expect(buyerReceipt.baseAmount).toBe(30);
    expect(buyerReceipt.buyerFee).toBe(Math.round((homeFees.buyerFee + farmFees.buyerFee) * 100) / 100);
    expect(buyerReceipt.sellerFee).toBe(Math.round((homeFees.sellerFee + farmFees.sellerFee) * 100) / 100);
    expect(buyerReceipt.buyerPays).toBe(Math.round((homeFees.totalCharge + farmFees.totalCharge) * 100) / 100);
    expect(buyerReceipt.sellerPayout).toBe(Math.round((homeFees.sellerPayout + farmFees.sellerPayout) * 100) / 100);
    expect(buyerReceipt.viewerLabel).toBe('You pay');
    expect(buyerReceipt.viewerAmount).toBe(buyerReceipt.buyerPays);
    const cookReceipt = await caller(SIX_AREA_MEALS[0].sellerId, tables).orders.finalReceipt({ orderId: multiHome.id });
    expect(cookReceipt.role).toBe('platemaker');
    expect(cookReceipt.lines).toHaveLength(2);
    expect(cookReceipt.viewerLabel).toBe('You receive');
    expect(cookReceipt.viewerAmount).toBe(homeFees.sellerPayout);
    const farmReceipt = await caller(SIX_AREA_MEALS[1].sellerId, tables).orders.finalReceipt({ orderId: multiFarm.id });
    expect(farmReceipt.viewerLabel).toBe('You receive');
    expect(farmReceipt.viewerAmount).toBe(farmFees.sellerPayout);
    expect(farmReceipt.lines.map((line) => line.mealName)).toEqual(['Cheesecake', 'Pumpkin pie']);
    await expect(caller(null, tables, false).orders.finalReceipt({ orderId: multiHome.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
