import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { app } from "../../hono";
import { alertKvWriteCap, KV_DAILY_WRITE_CAP } from "../kv-write-cap";
import { API_LIMIT, AUTH_LIMIT, createRequestLimit, requestLimit, type SharedLimiter } from "../request-limit";

function request(ip: string, path = "/", env?: Record<string, unknown>) {
  return app.request(`http://localhost${path}`, { headers: { "cf-connecting-ip": ip } }, env);
}

function countingLimiter(max: number): SharedLimiter {
  const counts = new Map<string, number>();
  return {
    async limit({ key }) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { success: next <= max };
    },
  };
}

describe.each([1, 2, 3])("request limits, run %s", () => {
  beforeEach(() => {
    requestLimit.reset();
  });

  it("shares one api count across isolates and keeps memory local", async () => {
    const shared = countingLimiter(API_LIMIT);
    const isolateA = createRequestLimit();
    const isolateB = createRequestLimit();
    for (let i = 0; i < API_LIMIT; i += 1) {
      expect((await isolateA.decide({
        scope: "api",
        ip: "198.51.100.10",
        production: true,
        shared,
        kv: null,
      })).result).toBe("allow");
    }
    expect((await isolateB.decide({
      scope: "api",
      ip: "198.51.100.10",
      production: true,
      shared,
      kv: null,
    })).result).toBe("limit");

    const memoryA = createRequestLimit();
    const memoryB = createRequestLimit();
    for (let i = 0; i < API_LIMIT; i += 1) {
      expect((await memoryA.decide({
        scope: "api",
        ip: "198.51.100.11",
        production: false,
        shared: null,
        kv: null,
      })).result).toBe("allow");
    }
    expect((await memoryB.decide({
      scope: "api",
      ip: "198.51.100.11",
      production: false,
      shared: null,
      kv: null,
    })).result).toBe("allow");
  });

  it("caps one isolate at 100 a minute when the binding is absent", async () => {
    let last = 200;
    for (let i = 0; i < API_LIMIT + 1; i += 1) {
      last = (await request("203.0.113.21")).status;
    }
    expect(last).toBe(429);
    const body = await (await request("203.0.113.21")).json();
    expect(body).toEqual({ error: "Too many requests, please try again later." });
  });

  it("does not write KV on an ordinary request", async () => {
    let puts = 0;
    const kv = {
      get: async () => null,
      put: async () => {
        puts += 1;
        throw new Error("KV put() limit exceeded for the day.");
      },
    };
    const response = await request("203.0.113.22", "/", {
      ENVIRONMENT: "production",
      RATE_LIMIT_KV: kv,
    });
    expect(response.status).toBe(200);
    expect(puts).toBe(0);
  });

  it("refuses production sign-in when no shared limiter and no KV are bound", async () => {
    const response = await request("203.0.113.23", "/api/auth/login", { ENVIRONMENT: "production" });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Service temporarily unavailable." });
  });

  it("keeps local sign-in on the memory count", async () => {
    const response = await request("203.0.113.24", "/api/auth/login");
    expect(response.status).toBe(404);
  });

  it("counts production sign-in in KV until the daily write cap, then stays on memory", async () => {
    let puts = 0;
    const store = new Map<string, string>();
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        puts += 1;
        if (puts === 1) throw new Error("KV put() limit exceeded for the day.");
        store.set(key, value);
      },
    };
    const errors: string[] = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    try {
      const first = await request("203.0.113.25", "/api/auth/login", {
        ENVIRONMENT: "production",
        RATE_LIMIT_KV: kv,
      });
      const second = await request("203.0.113.25", "/api/auth/login", {
        ENVIRONMENT: "production",
        RATE_LIMIT_KV: kv,
      });
      expect(first.status).not.toBe(500);
      expect(second.status).not.toBe(500);
      expect(await first.text()).not.toContain("Internal Server Error");
      expect(await second.text()).not.toContain("Internal Server Error");
      expect(puts).toBe(1);
      expect(errors.filter((line) => line.includes(KV_DAILY_WRITE_CAP))).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("uses the shared sign-in limiter and does not write KV", async () => {
    let puts = 0;
    const kv = {
      get: async () => null,
      put: async () => {
        puts += 1;
      },
    };
    const env = {
      ENVIRONMENT: "production",
      RATE_LIMIT_KV: kv,
      AUTH_RATE_LIMIT: countingLimiter(AUTH_LIMIT),
      API_RATE_LIMIT: countingLimiter(API_LIMIT),
    };
    let last = 0;
    for (let i = 0; i < AUTH_LIMIT + 1; i += 1) {
      last = (await request("203.0.113.26", "/api/auth/login", env)).status;
    }
    expect(last).toBe(429);
    expect(puts).toBe(0);
  });

  it("declares the shared limits on the Worker", () => {
    const toml = readFileSync(resolve(__dirname, "../../../wrangler.worker.toml"), "utf8");
    expect(toml).toContain('name = "API_RATE_LIMIT"');
    expect(toml).toContain('name = "AUTH_RATE_LIMIT"');
    expect(toml).toContain("limit = 100");
    expect(toml).toContain("limit = 10");
    expect(toml).toContain("period = 60");
  });

  it("records the write cap for an admin without an account number", async () => {
    const rows: Record<string, unknown>[] = [];
    const admin = {
      from() {
        return {
          insert: async (row: Record<string, unknown>) => {
            rows.push(row);
            return { error: null };
          },
        };
      },
    };
    await alertKvWriteCap(admin as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].alert_type).toBe("security_alert");
    expect(rows[0].severity).toBe("critical");
    const saved = JSON.stringify(rows[0]);
    expect(saved).toContain(KV_DAILY_WRITE_CAP);
    expect(saved).not.toMatch(/sk_live|sk_test|acct_/);
  });
});
