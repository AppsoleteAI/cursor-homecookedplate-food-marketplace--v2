import { app } from "../../hono";

function request(ip: string, env?: Record<string, unknown>) {
  return app.request(
    "http://localhost/",
    { headers: { "x-forwarded-for": ip } },
    env,
  );
}

describe("production rate limit fails closed", () => {
  const env = process.env as { NODE_ENV?: string; ENVIRONMENT?: string };
  const previousNodeEnv = env.NODE_ENV;
  const previousEnvironment = env.ENVIRONMENT;

  beforeEach(() => {
    env.NODE_ENV = "test";
    delete env.ENVIRONMENT;
  });

  afterAll(() => {
    env.NODE_ENV = previousNodeEnv;
    if (previousEnvironment === undefined) delete env.ENVIRONMENT;
    else env.ENVIRONMENT = previousEnvironment;
  });

  it("refuses production requests when RATE_LIMIT_KV is missing", async () => {
    const first = await request("203.0.113.10", { ENVIRONMENT: "production" });
    const second = await request("203.0.113.10", { ENVIRONMENT: "production" });

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    await expect(first.json()).resolves.toEqual({
      error: "Service temporarily unavailable.",
    });
  });

  it("counts production requests in KV when the binding is present", async () => {
    const store = new Map<string, string>();
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    };

    const response = await request("203.0.113.11", {
      ENVIRONMENT: "production",
      RATE_LIMIT_KV: kv,
    });

    expect(response.status).toBe(200);
    const saved = store.get("ratelimit:203.0.113.11");
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved as string).count).toBe(1);
  });

  it("keeps the in-memory fallback outside production", async () => {
    const response = await request("203.0.113.12");
    expect(response.status).toBe(200);
  });
});
