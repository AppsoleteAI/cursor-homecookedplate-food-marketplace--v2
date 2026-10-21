import { stayClockRestarts, stayIsReady } from '../metro-stay';

describe('metro stay', () => {
  const now = Date.parse('2026-10-19T18:00:00.000Z');

  it('keeps the saved metro through the first 30 minutes', () => {
    expect(stayIsReady('2026-10-19T17:45:00.000Z', now)).toBe(false);
    expect(stayIsReady('2026-10-19T17:30:00.000Z', now)).toBe(false);
  });

  it('commits after more than 30 minutes', () => {
    expect(stayIsReady('2026-10-19T17:29:59.000Z', now)).toBe(true);
  });

  it('does not commit a missing clock', () => {
    expect(stayIsReady(undefined, now)).toBe(false);
    expect(stayIsReady('not-a-time', now)).toBe(false);
  });

  it('starts the 30 minutes over after a gap with no reading', () => {
    expect(stayClockRestarts(undefined, now)).toBe(true);
    expect(stayClockRestarts('2026-10-19T17:40:00.000Z', now)).toBe(true);
    expect(stayClockRestarts('2026-10-19T17:55:00.000Z', now)).toBe(false);
  });
});
