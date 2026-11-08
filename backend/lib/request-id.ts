/** One id per Worker call. It is not taken from the client. */

export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function safeRequestId(value: unknown): string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : "none";
}

export function assignRequestId() {
  return async (c: { set: (key: string, value: string) => void; header: (key: string, value: string) => void }, next: () => Promise<void>) => {
    const id = createRequestId();
    c.set("requestId", id);
    c.header(REQUEST_ID_HEADER, id);
    await next();
  };
}

export function logRequestLimit(requestId: unknown, scope: "api" | "auth" | "account"): void {
  console.error(`REQUEST_LIMIT request_id=${safeRequestId(requestId)} scope=${scope}`);
}

export function logRateLimitUnbound(requestId: unknown, binding: "API_RATE_LIMIT" | "AUTH_RATE_LIMIT"): void {
  console.error(`RATE_LIMIT_UNBOUND binding=${binding} request_id=${safeRequestId(requestId)}`);
}

export function logRequestRejected(requestId: unknown, reason: string): void {
  const text = reason.replace(/\s+/g, " ").slice(0, 120);
  console.error(`REQUEST_REJECTED request_id=${safeRequestId(requestId)} reason=${text}`);
}

export function logPublicReadFailure(read: "listMeals" | "getMeal" | "listReviews", requestId: unknown, message: string): void {
  const text = message.replace(/\s+/g, " ").slice(0, 180);
  console.error(`PUBLIC_READ_FAILED request_id=${safeRequestId(requestId)} read=${read} ${text}`);
}

export function logPublicReadTiming(read: "listMeals" | "getMeal" | "listReviews", requestId: unknown, ms: number): void {
  const duration = Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : 0;
  console.log(`PUBLIC_READ read=${read} ms=${duration} request_id=${safeRequestId(requestId)}`);
}
