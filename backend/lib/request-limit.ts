import { logKvWriteCap } from "./kv-write-cap";
import { logRateLimitUnbound, logRequestLimit, logRequestRejected } from "./request-id";

/**
 * Per-minute request counts.
 * The shared binding is one counter for every isolate. Memory is the fallback
 * on the isolate that handled the request. Ordinary traffic does not write KV.
 */

export const API_LIMIT = 100;
export const AUTH_LIMIT = 10;
export const ACCOUNT_LIMIT = API_LIMIT;
export const LIMIT_WINDOW_MS = 60_000;

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function accountIdFromAuthorization(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  if (!match) return null;
  const payload = match[1].split(".")[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof json.sub === "string" && ACCOUNT_ID.test(json.sub) ? json.sub : null;
  } catch {
    return null;
  }
}

export type SharedLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type LimitStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type LimitDecision = {
  result: "allow" | "limit" | "unavailable";
  writeCapStarted: boolean;
  unboundBinding: "API_RATE_LIMIT" | "AUTH_RATE_LIMIT" | null;
};

type Bucket = { count: number; resetTime: number };

export function clientIp(header: (name: string) => string | null | undefined): string {
  const raw = header("cf-connecting-ip") || header("x-forwarded-for") || header("x-real-ip") || "unknown";
  const first = raw.split(",")[0]?.trim() || "unknown";
  return first.slice(0, 80);
}

export function createRequestLimit(now: () => number = () => Date.now()) {
  const memory = new Map<string, Bucket>();
  const notedUnbound = new Set<"api" | "auth">();
  let kvWritesBlocked = false;

  function memoryAllows(key: string, max: number, windowMs: number): boolean {
    const at = now();
    const record = memory.get(key);
    if (record && at < record.resetTime) {
      if (record.count >= max) return false;
      record.count += 1;
      return true;
    }
    memory.set(key, { count: 1, resetTime: at + windowMs });
    return true;
  }

  function noteCap(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 200);
    console.error("[Rate Limit] KV unavailable:", message);
    if (!/limit exceeded/i.test(message) || kvWritesBlocked) return false;
    kvWritesBlocked = true;
    return true;
  }

  async function kvAllows(kv: LimitStore, key: string, max: number, windowMs: number): Promise<boolean> {
    const at = now();
    const recordStr = await kv.get(key);
    let record: Bucket | null = null;
    if (recordStr) {
      try {
        record = JSON.parse(recordStr) as Bucket;
      } catch (parseError) {
        console.error("[Rate Limit] Failed to parse record:", parseError instanceof Error ? parseError.message : "unknown");
      }
    }
    if (record && at < record.resetTime) {
      if (record.count >= max) return false;
      record.count += 1;
      await kv.put(key, JSON.stringify(record), {
        expirationTtl: Math.max(60, Math.ceil((record.resetTime - at) / 1000)),
      });
      return true;
    }
    await kv.put(key, JSON.stringify({ count: 1, resetTime: at + windowMs }), {
      expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)),
    });
    return true;
  }

  return {
    reset() {
      memory.clear();
      notedUnbound.clear();
      kvWritesBlocked = false;
    },
    async decide(input: {
      scope: "api" | "auth" | "account";
      ip: string;
      accountId?: string | null;
      production: boolean;
      shared?: SharedLimiter | null;
      kv?: LimitStore | null;
    }): Promise<LimitDecision> {
      if (input.scope === "account" && !input.accountId) {
        return { result: "allow", writeCapStarted: false, unboundBinding: null };
      }
      const max = input.scope === "auth" ? AUTH_LIMIT : ACCOUNT_LIMIT;
      const subject = input.scope === "account" ? input.accountId : input.ip;
      const key = `ratelimit:${input.scope}:${max}:${subject}`;
      let unboundBinding: LimitDecision["unboundBinding"] = null;
      if ((input.scope === "api" || input.scope === "auth") && input.production && !input.shared && !notedUnbound.has(input.scope)) {
        notedUnbound.add(input.scope);
        unboundBinding = input.scope === "api" ? "API_RATE_LIMIT" : "AUTH_RATE_LIMIT";
      }

      if (input.shared) {
        try {
          const sharedKey = input.scope === "account" ? `account:${input.accountId}` : input.ip;
          const { success } = await input.shared.limit({ key: sharedKey });
          return { result: success ? "allow" : "limit", writeCapStarted: false, unboundBinding };
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          console.error("[Rate Limit] Shared limiter failed:", message.slice(0, 200));
        }
      }

      if (input.scope === "auth" && input.kv && !kvWritesBlocked) {
        try {
          const allowed = await kvAllows(input.kv, key, max, LIMIT_WINDOW_MS);
          return { result: allowed ? "allow" : "limit", writeCapStarted: false, unboundBinding };
        } catch (error) {
          const allowed = memoryAllows(key, max, LIMIT_WINDOW_MS);
          return { result: allowed ? "allow" : "limit", writeCapStarted: noteCap(error), unboundBinding };
        }
      }

      if (input.scope === "auth" && input.production && !input.kv && !kvWritesBlocked) {
        return { result: "unavailable", writeCapStarted: false, unboundBinding };
      }

      const allowed = memoryAllows(key, max, LIMIT_WINDOW_MS);
      return { result: allowed ? "allow" : "limit", writeCapStarted: false, unboundBinding };
    },
  };
}

export const requestLimit = createRequestLimit();

function productionEnv(env: { ENVIRONMENT?: string } | undefined): boolean {
  const name = env?.ENVIRONMENT || process.env.ENVIRONMENT || process.env.NODE_ENV;
  return name === "production";
}

export function limitRequest(scope: "api" | "auth", hooks?: { onWriteCap?: (env: unknown) => void }) {
  return async (c: any, next: any) => {
    const ip = clientIp((name) => c.req.header(name));
    let outcome: LimitDecision;
    try {
      outcome = await requestLimit.decide({
        scope,
        ip,
        production: productionEnv(c.env),
        shared: scope === "api" ? c.env?.API_RATE_LIMIT : c.env?.AUTH_RATE_LIMIT,
        kv: scope === "auth" ? c.env?.RATE_LIMIT_KV : null,
      });
    } catch (error) {
      console.error("[Rate Limit] Limiter failed:", error instanceof Error ? error.message : "unknown");
      await next();
      return;
    }
    if (outcome.unboundBinding) {
      logRateLimitUnbound(c.get?.("requestId"), outcome.unboundBinding);
    }
    if (outcome.writeCapStarted) {
      logKvWriteCap();
      try {
        hooks?.onWriteCap?.(c.env);
      } catch {
        console.error("[Rate Limit] Cap alert was not sent");
      }
    }
    if (outcome.result === "unavailable") {
      console.error("[Rate Limit] Refusing request because AUTH_RATE_LIMIT and RATE_LIMIT_KV are not bound");
      logRequestRejected(c.get?.("requestId"), "limiter-unbound");
      return c.json({ error: "Service temporarily unavailable." }, 503);
    }
    if (outcome.result === "limit") {
      logRequestLimit(c.get?.("requestId"), scope);
      return c.json({ error: "Too many requests, please try again later." }, 429);
    }
    if (scope === "api") {
      const accountId = accountIdFromAuthorization(c.req.header("authorization"));
      if (accountId) {
        let accountOutcome: LimitDecision;
        try {
          accountOutcome = await requestLimit.decide({
            scope: "account",
            ip,
            accountId,
            production: productionEnv(c.env),
            shared: c.env?.API_RATE_LIMIT,
            kv: null,
          });
        } catch (error) {
          console.error("[Rate Limit] Limiter failed:", error instanceof Error ? error.message : "unknown");
          await next();
          return;
        }
        if (accountOutcome.result === "limit") {
          logRequestLimit(c.get?.("requestId"), "account");
          return c.json({ error: "Too many requests, please try again later." }, 429);
        }
      }
    }
    await next();
  };
}
