import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SENTRY_TRACE_SAMPLE_RATE } from '../sentry-rate';

describe('Sentry trace sampling', () => {
  it('sends a fraction of traces instead of every transaction', () => {
    expect(SENTRY_TRACE_SAMPLE_RATE).toBe(0.1);
    expect(SENTRY_TRACE_SAMPLE_RATE).toBeLessThan(1);
  });

  it('does not sample error events', () => {
    const native = readFileSync(resolve(__dirname, '../sentry.ts'), 'utf8');
    const web = readFileSync(resolve(__dirname, '../sentry.web.ts'), 'utf8');
    const capture = native.slice(
      native.indexOf('export function captureException'),
      native.indexOf('export function captureMessage'),
    );
    expect(capture).not.toContain('SENTRY_TRACE_SAMPLE_RATE');
    expect(web).toContain('scrubSentryEvent');
    expect(web).toContain('sendDefaultPii: false');
  });
});
