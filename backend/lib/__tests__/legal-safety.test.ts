import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TERMS_OF_SERVICE_URL } from "@/constants/urls";
import { legalSurface } from "@/lib/legal-agreement";
import { sellerScreenEntry } from "@/lib/role-entry";
import { appRouter } from "../../trpc/app-router";

const PLATE_MAKER_ID = "11111111-1111-4111-8111-111111111111";
const PLATE_TAKER_ID = "22222222-2222-4222-8222-222222222222";

const agreement = {
  readFoodInformation: true,
  readStateInformation: true,
  acceptsLocalRules: true,
  acceptsAllLiability: true,
  waivesPlatformLiability: true,
  maintainsCommissaryAccess: true,
};

const legal = {
  sections: {
    jurisdictional_law: true as const,
    delivery_safety: true as const,
    liability_waiver: true as const,
    legal_safety_financial: true as const,
    allergy_food_safety: true as const,
    fee_structure: true as const,
    account_termination: true as const,
    uploaded_content: true as const,
    apple_eula: true as const,
  },
  acknowledgedOn: "2026-11-05",
  acknowledgedAt: "2026-11-05T22:00:00.000Z",
};

type Row = Record<string, unknown>;

function memoryAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: "select" | "update" | "insert" = "select";
      let patch: Row = {};
      const run = () => {
        const matched = rows.filter((row) => filters.every((fn) => fn(row)));
        if (mode === "update") {
          for (const row of matched) Object.assign(row, patch);
        }
        return { data: matched, error: null };
      };
      const one = () => {
        const result = run();
        const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        return { data, error: data ? null : { message: "missing" } };
      };
      const chain = {
        select() { return chain; },
        eq(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return chain;
        },
        order() { return chain; },
        limit() { return run(); },
        maybeSingle() { return one(); },
        single() { return one(); },
        update(next: Row) {
          mode = "update";
          patch = next;
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

function profile(id: string, role: "platemaker" | "platetaker"): Row {
  return {
    id,
    username: role === "platemaker" ? "cook" : "buyer",
    business_name: role === "platemaker" ? "Ada Kitchen" : "",
    email: role === "platemaker" ? "cook@example.com" : "buyer@example.com",
    role,
    phone: null,
    bio: null,
    profile_image: null,
    created_at: "2026-10-01T12:00:00.000Z",
    is_paused: false,
    two_factor_enabled: false,
    food_safety_acknowledged: true,
    legal_safety_agreement: null,
    kitchen_permit: null,
  };
}

function caller(userId: string | null, db: ReturnType<typeof memoryAdmin>, signedIn: boolean) {
  return appRouter.createCaller({
    req: { headers: new Headers(signedIn ? { Authorization: "Bearer local-proof" } : {}) },
    supabase: db,
    supabaseAdmin: db,
    userId,
    webUrl: "https://homecookedplate.com",
  } as never);
}

describe.each([1, 2, 3])("legal and safety, run %s", () => {
  it("saves the kitchen agreement for a cook and sends a buyer home", async () => {
    const screen = readFileSync(resolve(__dirname, "../../../app/kitchen-permit.tsx"), "utf8");
    expect(screen).toContain("SellerOnly");
    expect(screen).toContain("Save agreement");

    for (const role of ["platemaker", "platetaker"] as const) {
      expect(sellerScreenEntry({ loading: false, signedIn: false, role })).toBe("sign-in");
      expect(legalSurface(false)).toEqual({ kind: "public-terms", url: TERMS_OF_SERVICE_URL });
    }
    expect(sellerScreenEntry({ loading: true, signedIn: true, role: "platemaker" })).toBe("wait");
    expect(sellerScreenEntry({ loading: false, signedIn: true, role: "platemaker" })).toBe("open");
    expect(sellerScreenEntry({ loading: false, signedIn: true, role: "platetaker" })).toBe("home");
    expect(legalSurface(true)).toEqual({ kind: "account", url: null });

    const terms = readFileSync(resolve(__dirname, "../../../pages/legal/terms.html"), "utf8");
    expect(terms).toContain("Apple app license");
    expect(terms).toContain("Terms of Use");

    const tables: Record<string, Row[]> = {
      profiles: [profile(PLATE_MAKER_ID, "platemaker"), profile(PLATE_TAKER_ID, "platetaker")],
    };
    const db = memoryAdmin(tables);
    const cook = caller(PLATE_MAKER_ID, db, true);
    const buyer = caller(PLATE_TAKER_ID, db, true);
    await expect(cook.meals.saveKitchenPermit(agreement)).rejects.toMatchObject({
      message: expect.stringContaining("Legal & Safety"),
    });
    await expect(buyer.meals.saveKitchenPermit(agreement)).rejects.toMatchObject({
      message: expect.stringContaining("Legal & Safety"),
    });

    await cook.auth.updateProfile({ legalSafetyAgreement: legal });
    await buyer.auth.updateProfile({ legalSafetyAgreement: legal });
    const saved = await cook.meals.saveKitchenPermit(agreement);
    expect(saved.saved).toBe(true);
    expect(tables.profiles[0].kitchen_permit).toMatchObject(agreement);
    await expect(buyer.meals.saveKitchenPermit(agreement)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tables.profiles[1].kitchen_permit).toBeNull();
    expect(tables.profiles[0].legal_safety_agreement).toMatchObject(legal);
    expect(tables.profiles[1].legal_safety_agreement).toMatchObject(legal);

    const signedOut = caller(null, db, false);
    await expect(signedOut.auth.updateProfile({ legalSafetyAgreement: legal })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(signedOut.meals.saveKitchenPermit(agreement)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});