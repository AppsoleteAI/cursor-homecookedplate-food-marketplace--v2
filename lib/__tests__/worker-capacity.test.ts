import {
  BUSY_MESSAGE,
  FREE_WORKER_REQUESTS_PER_UTC_DAY,
  WORKER_DAILY_LIMIT_MESSAGE,
  cloudflareDailyLimit,
  fitsFreeWorkerDay,
  plainTextFailureMessage,
  replacementForPlainBody,
  requestsForDay,
} from '../worker-capacity';

describe('free Worker day', () => {
  it('stops an open from 10,000 people, a 30-call day, and a dinner rush', () => {
    const opened = requestsForDay(10_000, 12);
    const normal = requestsForDay(10_000, 30);
    const dinner = requestsForDay(10_000, 50);
    expect(opened).toBe(120_000);
    expect(normal).toBe(300_000);
    expect(dinner).toBe(500_000);
    expect(fitsFreeWorkerDay(opened)).toBe(false);
    expect(fitsFreeWorkerDay(normal)).toBe(false);
    expect(fitsFreeWorkerDay(dinner)).toBe(false);
    expect(fitsFreeWorkerDay(FREE_WORKER_REQUESTS_PER_UTC_DAY)).toBe(true);
    expect(fitsFreeWorkerDay(FREE_WORKER_REQUESTS_PER_UTC_DAY + 1)).toBe(false);
  });

  it('names error 1027 and leaves a real API error alone', () => {
    const html = '<html><title>Error 1027</title><p>Rate limited</p></html>';
    expect(cloudflareDailyLimit(429, html)).toBe(true);
    expect(cloudflareDailyLimit(1027, '')).toBe(true);
    expect(cloudflareDailyLimit(503, 'Ray ID: 1102799')).toBe(false);
    expect(plainTextFailureMessage(429, html)).toBe(WORKER_DAILY_LIMIT_MESSAGE);
    expect(plainTextFailureMessage(502, '<html>Bad gateway</html>')).toBe(BUSY_MESSAGE);

    const daily = replacementForPlainBody(429, html);
    expect(daily).toContain(WORKER_DAILY_LIMIT_MESSAGE);
    expect(JSON.parse(daily as string).error.json.data.httpStatus).toBe(429);

    const trpc = '{"error":{"json":{"message":"Confirm your email","code":-32603}}}';
    expect(replacementForPlainBody(401, trpc)).toBeNull();
    expect(replacementForPlainBody(429, '{"code":1027}')).toContain(WORKER_DAILY_LIMIT_MESSAGE);
  });
});
