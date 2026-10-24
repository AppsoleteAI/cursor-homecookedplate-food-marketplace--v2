import { fixAgeMs, fixQuality, normalizeUsPoint } from '@/lib/location-fix';

describe('location fix', () => {
  it('accepts a tight recent reading and rejects a cell or cached one', () => {
    expect(fixQuality({ lat: 40.44, lng: -79.99, accuracy: 12, ageMs: 1000 })).toBe('precise');
    expect(fixQuality({ lat: 40.44, lng: -79.99, accuracy: 180, ageMs: 1000 })).toBe('usable');
    expect(fixQuality({ lat: 40.44, lng: -79.99, accuracy: 2500, ageMs: 1000 })).toBe('reject');
    expect(fixQuality({ lat: 40.44, lng: -79.99, accuracy: 12, ageMs: 60_000 })).toBe('reject');
    expect(fixQuality({ lat: 40.44, lng: -79.99, accuracy: 0, ageMs: 1000 })).toBe('reject');
    expect(fixQuality({ lat: 0, lng: 0, accuracy: 5, ageMs: 1000 })).toBe('reject');
  });

  it('turns a reversed continental US reading back around and leaves a real one', () => {
    expect(normalizeUsPoint(-79.9959, 40.4406)).toEqual({ lat: 40.4406, lng: -79.9959 });
    expect(normalizeUsPoint(40.4406, -79.9959)).toEqual({ lat: 40.4406, lng: -79.9959 });
    expect(normalizeUsPoint(21.3069, -157.8583)).toEqual({ lat: 21.3069, lng: -157.8583 });
  });

  it('reads a seconds timestamp as milliseconds', () => {
    const now = 1_700_000_000_000;
    expect(fixAgeMs(1_700_000_000, now)).toBe(0);
    expect(fixAgeMs(now - 2000, now)).toBe(2000);
  });
});
