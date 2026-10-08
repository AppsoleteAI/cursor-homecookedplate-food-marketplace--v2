import { SENTRY_TRACE_SAMPLE_RATE } from '../sentry-rate';

describe('Sentry trace sampling', () => {
  it('sends a fraction of traces instead of every transaction', () => {
    expect(SENTRY_TRACE_SAMPLE_RATE).toBe(0.1);
    expect(SENTRY_TRACE_SAMPLE_RATE).toBeLessThan(1);
  });
});
