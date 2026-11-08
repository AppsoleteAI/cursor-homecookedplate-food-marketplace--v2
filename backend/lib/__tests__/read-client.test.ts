import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readApiUrl } from "../supabase";

const root = resolve(__dirname, "../../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("read client", () => {
  it("stays on the primary URL until a replica HTTPS URL is set", () => {
    const primary = "https://example.supabase.co";
    expect(readApiUrl(primary, undefined)).toBe(primary);
    expect(readApiUrl(primary, "  ")).toBe(primary);
    expect(readApiUrl(primary, primary)).toBe(primary);
    expect(readApiUrl(primary, "https://example.pooler.supabase.com:6543")).toBe(primary);
    expect(readApiUrl(primary, "postgresql://example.supabase.co")).toBe(primary);
    expect(readApiUrl(primary, "https://replica.example.supabase.co/")).toBe("https://replica.example.supabase.co");
  });

  it("points the plate list, the plate page, and the review list at the read client", () => {
    const list = source("backend/trpc/routes/meals/list/route.ts");
    const page = source("backend/trpc/routes/meals/get/route.ts");
    const reviews = source("backend/trpc/routes/reviews/list/route.ts");
    const context = source("backend/trpc/create-context.ts");
    expect(list).toContain("ctx.supabaseRead");
    expect(list).not.toMatch(/ctx\.supabase[^AR]/);
    expect(page).toContain("ctx.supabaseRead");
    expect(page).toContain("from('meals')");
    expect(reviews).toContain("ctx.supabaseRead");
    expect(reviews).toContain("from('reviews')");
    expect(list).toContain("ctx.supabaseAdmin");
    expect(page).toContain("ctx.supabaseAdmin");
    expect(reviews).toContain("ctx.supabaseAdmin");
    expect(context).toContain("readApiUrl");
    expect(context).toContain("supabaseRead");
    expect(context).not.toContain("SUPABASE_SERVICE_ROLE_KEY: env");
  });
});
