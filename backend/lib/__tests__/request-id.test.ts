import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { app } from "../../hono";
import { JSON_BODY_MAX_BYTES } from "../body-limit";
import {
  REQUEST_ID_HEADER,
  logPublicReadFailure,
  logRequestLimit,
  safeRequestId,
} from "../request-id";
import type { SharedLimiter } from "../request-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function limiter(max: number): SharedLimiter {
  const counts = new Map<string, number>();
  return {
    async limit({ key }) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { success: next <= max };
    },
  };
}

describe("request ids", () => {
  it("assigns a new id on each call and ignores a client id", async () => {
    const first = await app.request("http://localhost/", {
      headers: { "x-request-id": "from-the-client", "cf-connecting-ip": "203.0.113.80" },
    });
    const second = await app.request("http://localhost/", {
      headers: { "cf-connecting-ip": "203.0.113.81" },
    });
    const firstId = first.headers.get(REQUEST_ID_HEADER);
    const secondId = second.headers.get(REQUEST_ID_HEADER);
    expect(firstId).toMatch(UUID);
    expect(secondId).toMatch(UUID);
    expect(firstId).not.toBe(secondId);
    expect(firstId).not.toBe("from-the-client");
  });

  it("writes that id on a limit and on a body refusal", async () => {
    const lines: string[] = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    try {
      const shared = limiter(1);
      const allowed = await app.request("http://localhost/api/trpc/orders.list", {
        method: "GET",
        headers: { "cf-connecting-ip": "203.0.113.82" },
      }, { API_RATE_LIMIT: shared });
      const limited = await app.request("http://localhost/api/trpc/orders.list", {
        method: "GET",
        headers: { "cf-connecting-ip": "203.0.113.82" },
      }, { API_RATE_LIMIT: shared });
      expect(allowed.status).not.toBe(429);
      expect(limited.status).toBe(429);
      const limitedId = limited.headers.get(REQUEST_ID_HEADER);
      expect(lines.some((line) => line.includes(`REQUEST_LIMIT request_id=${limitedId} scope=api`))).toBe(true);

      const refused = await app.request("http://localhost/api/trpc/orders.create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(JSON_BODY_MAX_BYTES + 1),
          "cf-connecting-ip": "203.0.113.83",
        },
        body: "{}",
      });
      expect(refused.status).toBe(413);
      const refusedId = refused.headers.get(REQUEST_ID_HEADER);
      expect(lines.some((line) => line.includes("BODY_TOO_LARGE") && line.includes(`request_id=${refusedId}`))).toBe(true);
      expect(lines.some((line) => line.includes("203.0.113"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("writes that id on a failed public read and leaves a missing plate alone", () => {
    const lines: string[] = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    try {
      logPublicReadFailure("listMeals", "11111111-1111-4111-8111-111111111111", "database unavailable");
      logPublicReadFailure("getMeal", "not-an-id", "connection reset");
      logRequestLimit("also-not-an-id", "auth");
      expect(lines[0]).toBe("PUBLIC_READ_FAILED request_id=11111111-1111-4111-8111-111111111111 read=listMeals database unavailable");
      expect(lines[1]).toContain("request_id=none");
      expect(lines[1]).toContain("read=getMeal");
      expect(lines[2]).toBe("REQUEST_LIMIT request_id=none scope=auth");
      expect(safeRequestId("11111111-1111-4111-8111-111111111111")).toBe("11111111-1111-4111-8111-111111111111");
    } finally {
      spy.mockRestore();
    }

    const root = resolve(__dirname, "../../..");
    const list = readFileSync(resolve(root, "backend/trpc/routes/meals/list/route.ts"), "utf8");
    const page = readFileSync(resolve(root, "backend/trpc/routes/meals/get/route.ts"), "utf8");
    const reviews = readFileSync(resolve(root, "backend/trpc/routes/reviews/list/route.ts"), "utf8");
    expect(list).toContain('logPublicReadFailure("listMeals"');
    expect(page).toContain('logPublicReadFailure("getMeal"');
    expect(page).toContain("if (error?.message)");
    expect(reviews).toContain('logPublicReadFailure("listReviews"');
  });
});
