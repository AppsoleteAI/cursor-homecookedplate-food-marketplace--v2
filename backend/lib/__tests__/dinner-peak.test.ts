import { app } from "../../hono";
import { API_LIMIT, requestLimit, type SharedLimiter } from "../request-limit";

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

function call(path: string, ip: string, env: Record<string, unknown>) {
  return app.request(`http://localhost${path}`, { headers: { "cf-connecting-ip": ip } }, env);
}

describe.each([1, 2, 3])("dinner-peak shape, run %s", () => {
  beforeEach(() => {
    requestLimit.reset();
  });

  it("serves a burst for many kitchens and homes, then stops one address", async () => {
    const env = {
      ENVIRONMENT: "production",
      API_RATE_LIMIT: countingLimiter(API_LIMIT),
      AUTH_RATE_LIMIT: countingLimiter(10),
    };
    const burst = await Promise.all(
      Array.from({ length: 40 }, (_, index) => call("/", `198.51.100.${index + 1}`, env)),
    );
    expect(burst.map((response) => response.status)).toEqual(Array(40).fill(200));

    const statuses: number[] = [];
    for (let i = 0; i < API_LIMIT + 1; i += 1) {
      statuses.push((await call("/", "203.0.113.40", env)).status);
    }
    expect(statuses.slice(0, API_LIMIT).every((status) => status === 200)).toBe(true);
    expect(statuses[API_LIMIT]).toBe(429);

    const signIn: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      signIn.push((await call("/api/auth/login", "203.0.113.41", env)).status);
    }
    expect(signIn.slice(0, 10).every((status) => status === 404)).toBe(true);
    expect(signIn[10]).toBe(429);
    expect(statuses.concat(signIn, burst.map((response) => response.status))).not.toContain(500);
  }, 20000);
});
