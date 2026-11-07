/** Free Workers plan on plate-marketplace-api. Workers Paid stays off until revenue covers it. */
export const FREE_WORKER_REQUESTS_PER_UTC_DAY = 100_000;

export const WORKER_DAILY_LIMIT_MESSAGE =
  'HomeCookedPlate has reached its limit for today. Sign-in, the kitchen, home, and checkout resume at midnight UTC.';

export const BUSY_MESSAGE = 'Our kitchen is a bit busy right now. Please try again in a moment!';

export function requestsForDay(people: number, requestsEach: number): number {
  if (!Number.isFinite(people) || !Number.isFinite(requestsEach) || people < 0 || requestsEach < 0) return 0;
  return Math.round(people * requestsEach);
}

export function fitsFreeWorkerDay(requests: number): boolean {
  return Number.isFinite(requests) && requests <= FREE_WORKER_REQUESTS_PER_UTC_DAY;
}

/** Cloudflare error 1027 is the free-plan daily request wall. */
export function cloudflareDailyLimit(status: number, body: string): boolean {
  if (status === 1027) return true;
  return /(?:^|[^0-9])1027(?:[^0-9]|$)/.test(body);
}

export function plainTextFailureMessage(status: number, body: string): string {
  return cloudflareDailyLimit(status, body) ? WORKER_DAILY_LIMIT_MESSAGE : BUSY_MESSAGE;
}

/** JSON stand-in for an HTML or plain Cloudflare page. A real tRPC JSON body stays untouched. */
export function replacementForPlainBody(status: number, body: string): string | null {
  const trimmed = body.trim();
  const json = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (json && !cloudflareDailyLimit(status, body)) return null;
  return JSON.stringify({
    error: {
      json: {
        message: plainTextFailureMessage(status, body),
        code: -32603,
        data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: status },
      },
    },
  });
}
