import { reorderPickup } from '../pickup-time';

describe('reorder pickup', () => {
  const now = Date.parse('2026-10-20T16:00:00.000Z');

  it('drops a pickup time that has already passed', () => {
    expect(reorderPickup('2026-10-20T15:00:00.000Z', now)).toBeUndefined();
    expect(reorderPickup(new Date('2026-10-20T16:00:00.000Z'), now)).toBeUndefined();
    expect(reorderPickup(null, now)).toBeUndefined();
  });

  it('keeps a pickup time that is still ahead', () => {
    const kept = reorderPickup('2026-10-20T18:00:00.000Z', now);
    expect(kept?.toISOString()).toBe('2026-10-20T18:00:00.000Z');
  });
});