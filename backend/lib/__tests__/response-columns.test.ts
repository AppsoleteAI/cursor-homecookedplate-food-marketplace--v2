import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { orderListColumns, readOrderQuery } from "../order-row";
import {
  ACCOUNT_PROFILE_COLUMNS,
  readProfileRow,
  ROLE_PROFILE_COLUMNS,
  SAVED_PROFILE_COLUMNS,
  SIGN_IN_PROFILE_COLUMNS,
  SIGN_UP_PROFILE_COLUMNS,
} from "../profile-columns";

const root = resolve(__dirname, "../../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const orderAndAccountRoutes = [
  "backend/trpc/routes/auth/me/route.ts",
  "backend/trpc/routes/auth/login/route.ts",
  "backend/trpc/routes/auth/signup/route.ts",
  "backend/trpc/routes/auth/update-profile/route.ts",
  "backend/trpc/routes/auth/request-platemaker-role/route.ts",
  "backend/trpc/routes/auth/export-data/route.ts",
  "backend/trpc/routes/auth/verify-email/route.ts",
  "backend/trpc/routes/orders/list/route.ts",
  "backend/trpc/routes/orders/create/route.ts",
  "backend/trpc/routes/orders/update-status/route.ts",
  "backend/trpc/routes/orders/update-payment-intent/route.ts",
  "backend/trpc/routes/orders/abandon-unpaid/route.ts",
  "backend/trpc/routes/payments/confirm-payment/route.ts",
  "backend/trpc/routes/payments/create-payment-intent/route.ts",
  "backend/trpc/routes/payments/create-connect-account/route.ts",
  "backend/trpc/routes/platemaker/get-incoming-orders/route.ts",
  "backend/lib/record-paid-order.ts",
];

describe("order and account response columns", () => {
  it("names the order columns and retries when buyer_id is absent", async () => {
    expect(orderListColumns("buyer_id")).toContain("buyer_id");
    expect(orderListColumns("buyer_id")).toContain("platetaker_id");
    expect(orderListColumns("buyer_id")).toContain("seller_id");
    expect(orderListColumns("buyer_id")).toContain("total_price");
    expect(orderListColumns("buyer_id")).toContain("total_price_cents");
    expect(orderListColumns("buyer_id")).toContain("special_instructions");
    expect(orderListColumns("platetaker_id")).not.toContain("buyer_id");
    expect(orderListColumns("platetaker_id")).toContain("platetaker_id");

    const seen: string[] = [];
    const result = await readOrderQuery(async (columns) => {
      seen.push(columns);
      if (columns.includes("buyer_id")) {
        return { data: null, error: { message: 'column "buyer_id" does not exist' } };
      }
      return { data: [{ id: "order-1" }], error: null };
    });
    expect(result.data).toEqual([{ id: "order-1" }]);
    expect(seen).toHaveLength(2);
    expect(seen[1]).not.toContain("buyer_id");

    const note = await readOrderQuery(async (columns) => {
      if (columns.includes("instructions_status")) {
        return { data: null, error: { message: 'column "instructions_status" does not exist' } };
      }
      return { data: [{ id: "order-2", buyer_id: "buyer-1" }], error: null };
    });
    expect(note.data).toEqual([{ id: "order-2", buyer_id: "buyer-1" }]);
  });

  it("drops a missing profile column and reads the row again", async () => {
    expect(SIGN_IN_PROFILE_COLUMNS).toContain("legal_safety_agreement");
    expect(SIGN_IN_PROFILE_COLUMNS).toContain("ordering_removed");
    expect(ACCOUNT_PROFILE_COLUMNS).toContain("membership_tier");
    expect(ACCOUNT_PROFILE_COLUMNS).toContain("apple_original_transaction_id");
    expect(SIGN_UP_PROFILE_COLUMNS).toContain("metro_area");
    expect(SAVED_PROFILE_COLUMNS).toContain("food_safety_acknowledged");
    expect(ROLE_PROFILE_COLUMNS).toContain("two_factor_enabled");

    const seen: string[] = [];
    const result = await readProfileRow(SIGN_IN_PROFILE_COLUMNS, async (columns) => {
      seen.push(columns);
      if (columns.includes("main_admin")) {
        return { data: null, error: { message: "Could not find the 'main_admin' column of 'profiles' in the schema cache" } };
      }
      return { data: { id: "cook-1", role: "platemaker" }, error: null };
    });
    expect(result.data).toEqual({ id: "cook-1", role: "platemaker" });
    expect(seen[0]).toContain("main_admin");
    expect(seen[1]).not.toContain("main_admin");
    expect(seen[1]).toContain("monitor_admin");
  });

  it("keeps a star off the order, payment, and account responses", () => {
    for (const path of orderAndAccountRoutes) {
      const text = source(path);
      expect(text).not.toMatch(/\.select\(\s*['"]\*['"]\s*\)/);
      expect(text).not.toMatch(/\.select\(\s*\)/);
    }
    expect(source("backend/trpc/routes/orders/list/route.ts")).toContain("orderListColumns");
    expect(source("backend/trpc/routes/platemaker/get-incoming-orders/route.ts")).toContain("orderListColumns");
    expect(source("backend/lib/record-paid-order.ts")).toContain("readOrderQuery");
    expect(source("backend/trpc/routes/auth/me/route.ts")).toContain("ACCOUNT_PROFILE_COLUMNS");
    expect(source("backend/trpc/routes/auth/login/route.ts")).toContain("SIGN_IN_PROFILE_COLUMNS");
  });
});
