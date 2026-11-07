import { appRouter } from "../../trpc/app-router";
import { buyerCardCharge, buyerServiceFeePercent, calculateFees, orderTotalWithDelivery } from "../fees";
import { pickupConfirmedByBoth } from "../order-status";
import { recordPlatePayment } from "../record-paid-order";

jest.mock("../email", () => ({
  sendNoticeEmail: jest.fn(async () => true),
}));

const PLATE_MAKER_ID = "11111111-1111-4111-8111-111111111111";
const PLATE_TAKER_ID = "22222222-2222-4222-8222-222222222222";
const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const ORDER_ID = "44444444-4444-4444-8444-444444444444";
const PAYMENT_INTENT = "pi_local_accept";
const LOCAL_STRIPE_KEY = "sk_test_local_not_a_real_key";

type Row = Record<string, unknown>;

function memoryAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: "select" | "update" | "insert" = "select";
      let patch: Row = {};
      let pendingInsert: Row | null = null;
      const run = () => {
        if (mode === "insert" && pendingInsert) {
          const saved = pendingInsert;
          pendingInsert = null;
          rows.push(saved);
          return { data: saved, error: null };
        }
        const matched = rows.filter((row) => filters.every((fn) => fn(row)));
        if (mode === "update") {
          for (const row of matched) Object.assign(row, patch);
        }
        return { data: matched, error: null };
      };
      const one = (missingIsError: boolean) => {
        const result = run();
        const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        return { data, error: data || !missingIsError ? null : { message: "missing" } };
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
        maybeSingle() { return one(false); },
        single() { return one(true); },
        update(next: Row) {
          mode = "update";
          patch = next;
          return chain;
        },
        insert(next: Row) {
          mode = "insert";
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

function caller(userId: string, db: ReturnType<typeof memoryAdmin>) {
  return appRouter.createCaller({
    req: { headers: new Headers({ Authorization: "Bearer local-proof" }) },
    supabase: db,
    supabaseAdmin: db,
    userId,
    webUrl: "https://homecookedplate.com",
    stripeSecretKey: LOCAL_STRIPE_KEY,
  } as never);
}

describe.each([1, 2, 3])("local two-party plate, run %s", () => {
  it("marks the buyer payment paid and lets the cook accept without a live card", async () => {
    const tables: Record<string, Row[]> = {
      profiles: [
        { id: PLATE_MAKER_ID, role: "platemaker", is_paused: false, membership_tier: "premium", created_at: "2026-01-01T00:00:00.000Z", legal_safety_agreement: { sections: { jurisdictional_law: true, delivery_safety: true, liability_waiver: true, legal_safety_financial: true, allergy_food_safety: true, fee_structure: true, account_termination: true, uploaded_content: true, apple_eula: true }, acknowledgedOn: "2026-11-05", acknowledgedAt: "2026-11-05T22:00:00.000Z" } },
        { id: PLATE_TAKER_ID, role: "platetaker", is_paused: false, membership_tier: "premium", created_at: "2026-01-01T00:00:00.000Z", legal_safety_agreement: { sections: { jurisdictional_law: true, delivery_safety: true, liability_waiver: true, legal_safety_financial: true, allergy_food_safety: true, fee_structure: true, account_termination: true, uploaded_content: true, apple_eula: true }, acknowledgedOn: "2026-11-05", acknowledgedAt: "2026-11-05T22:00:00.000Z" } },
      ],
      meals: [{ id: MEAL_ID, tags: ["portions:2"] }],
      orders: [{
        id: ORDER_ID,
        payment_intent_id: PAYMENT_INTENT,
        buyer_id: PLATE_TAKER_ID,
        platetaker_id: PLATE_TAKER_ID,
        seller_id: PLATE_MAKER_ID,
        meal_id: MEAL_ID,
        quantity: 1,
        total_price: 20,
        status: "pending",
        paid: false,
        created_at: "2026-11-05T04:00:00.000Z",
      }],
      transactions: [],
      notifications: [],
      audit_logs: [],
    };
    const db = memoryAdmin(tables);
    const percent = buyerServiceFeePercent({ role: "platetaker", membershipTier: "premium", baseAmount: 20 });
    const fees = calculateFees(20, percent, 10);
    const card = buyerCardCharge(orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, 0).buyerPays);
    const amountCents = Math.round(card.cardCharge * 100);
    const paid = await recordPlatePayment(db, {
      paymentIntentId: PAYMENT_INTENT,
      chargeId: "ch_local_accept",
      currency: "usd",
      amountCents,
      listedOrderIds: [ORDER_ID],
      listedBaseCents: 2000,
    });
    expect(paid).toBe(1);
    expect(tables.orders[0].paid).toBe(true);
    expect(tables.transactions[0].status).toBe("held");
    expect(LOCAL_STRIPE_KEY.startsWith("sk_live")).toBe(false);

    const buyer = caller(PLATE_TAKER_ID, db);
    await expect(buyer.platemaker.acceptOrder({ orderId: ORDER_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(tables.orders[0].status).toBe("pending");

    const calls: { url: string; authorization: string }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("Authorization") || "";
      calls.push({ url, authorization });
      if (!url.startsWith("https://api.stripe.com/")) {
        throw new Error("This proof does not use the network");
      }
      return new Response(JSON.stringify({
        status: "succeeded",
        amount: amountCents,
        metadata: { order_ids: ORDER_ID, base_cents: "2000", delivery_fee: "0" },
      }), { status: 200 });
    }) as typeof fetch;

    try {
      const accepted = await caller(PLATE_MAKER_ID, db).platemaker.acceptOrder({ orderId: ORDER_ID });
      expect(accepted.status).toBe("accepted");
    } finally {
      globalThis.fetch = original;
    }

    expect(tables.orders[0].status).toBe("accepted");
    expect(tables.orders[0].seller_id).toBe(PLATE_MAKER_ID);
    expect(tables.orders[0].buyer_id).toBe(PLATE_TAKER_ID);
    expect(tables.transactions[0].status).toBe("held");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(PAYMENT_INTENT);
    expect(calls[0].authorization).toBe(`Bearer ${LOCAL_STRIPE_KEY}`);
    expect(calls[0].authorization).not.toContain("sk_live");
    expect(pickupConfirmedByBoth(["seller"])).toBe(false);
    expect(pickupConfirmedByBoth(["buyer", "seller"])).toBe(true);
  });
});
