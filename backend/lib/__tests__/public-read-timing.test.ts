import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { timePublicRead } from "../public-read-timing";
import { publicReadSampled, reportPublicReadTiming } from "../worker-sentry";

const root = resolve(__dirname, "../../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("public read timing", () => {
  it("sends one in ten traces and leaves crashes unsampled", () => {
    expect(publicReadSampled(0)).toBe(true);
    expect(publicReadSampled(0.099)).toBe(true);
    expect(publicReadSampled(0.1)).toBe(false);
    expect(publicReadSampled(0.5)).toBe(false);
  });

  it("logs every public read and still returns the rows", async () => {
    const lines: string[] = [];
    const spy = jest.spyOn(console, "log").mockImplementation((line?: unknown) => {
      lines.push(String(line));
    });
    const noted: { read: string; ms: number }[] = [];
    const rows = await timePublicRead("listMeals", {
      requestId: "11111111-1111-4111-8111-111111111111",
      notePublicRead: (read, ms) => noted.push({ read, ms }),
    }, async () => [{ id: "plate-1" }]);
    spy.mockRestore();
    expect(rows).toEqual([{ id: "plate-1" }]);
    expect(lines.some((line) => line.startsWith("PUBLIC_READ read=listMeals ms=") && line.includes("request_id=11111111-1111-4111-8111-111111111111"))).toBe(true);
    expect(noted[0]?.read).toBe("listMeals");
    expect(noted[0]?.ms).toBeGreaterThanOrEqual(0);
    expect(lines.join(" ")).not.toContain("cook-account");
  });

  it("sends a sampled timing for each role and skips the rest", async () => {
    const calls: { url: string; body: string; auth: string }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: String(init?.body ?? ""),
        auth: new Headers(init?.headers).get("X-Sentry-Auth") ?? "",
      });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const dsn = "https://public@example.test/123";

    expect(await reportPublicReadTiming({
      read: "getMeal",
      ms: 12,
      dsn: "",
      roll: 0,
      fetchImpl,
    })).toBe(false);
    expect(calls).toHaveLength(0);

    for (const role of ["platemaker", "platetaker"] as const) {
      calls.length = 0;
      const id = role === "platemaker" ? "cook-account" : "buyer-account";
      const sent = await reportPublicReadTiming({
        read: role === "platemaker" ? "listMeals" : "listReviews",
        ms: 18,
        requestId: "22222222-2222-4222-8222-222222222222",
        userId: id,
        dsn,
        roll: 0,
        fetchImpl,
      });
      expect(sent).toBe(true);
      expect(calls[0].url).toBe("https://example.test/api/123/store/");
      expect(calls[0].auth).toContain("sentry_key=public");
      const body = JSON.parse(calls[0].body) as {
        type?: string;
        transaction?: string;
        user?: { id?: string; email?: string };
        measurements?: { public_read?: { value?: number; unit?: string } };
      };
      expect(body.type).toBe("transaction");
      expect(body.transaction).toBe(role === "platemaker" ? "listMeals" : "listReviews");
      expect(body.user).toEqual({ id });
      expect(body.measurements?.public_read).toEqual({ value: 18, unit: "millisecond" });
      expect(calls[0].body).not.toContain(`${role}@example.com`);
      expect(calls[0].body).not.toContain("Bearer");
    }

    calls.length = 0;
    expect(await reportPublicReadTiming({
      read: "getMeal",
      ms: 4,
      userId: null,
      dsn,
      roll: 0.5,
      fetchImpl,
    })).toBe(false);
    expect(calls).toHaveLength(0);

    const signedOut = await reportPublicReadTiming({
      read: "listReviews",
      ms: 7,
      userId: null,
      dsn,
      roll: 0,
      fetchImpl,
    });
    expect(signedOut).toBe(true);
    const open = JSON.parse(calls[0].body) as { user?: { id?: string } };
    expect(open.user).toBeUndefined();
  });

  it("times the three public reads through the existing Sentry client", () => {
    const list = source("backend/trpc/routes/meals/list/route.ts");
    const page = source("backend/trpc/routes/meals/get/route.ts");
    const reviews = source("backend/trpc/routes/reviews/list/route.ts");
    const context = source("backend/trpc/create-context.ts");
    const worker = source("backend/hono.ts");
    expect(list).toContain('timePublicRead("listMeals"');
    expect(page).toContain('timePublicRead("getMeal"');
    expect(reviews).toContain('timePublicRead("listReviews"');
    expect(context).toContain("reportPublicReadTiming");
    expect(worker).toContain("SENTRY_DSN: c.env?.SENTRY_DSN");
    expect(worker).toContain("c.executionCtx.waitUntil(work)");
    expect(worker).not.toContain("pagerduty");
  });
});
