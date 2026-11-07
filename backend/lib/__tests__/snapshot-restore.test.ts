import {
  COMPUTE_MEMORY_MB,
  COMPUTE_SIZE,
  MEAL_MEDIA_BUCKET,
  PROFILE_IMAGE_BUCKET,
  SNAPSHOT_RETENTION_DAYS,
  STORAGE_INCLUDED_GB,
  snapshotIncludes,
} from '../snapshot-restore';

describe('nightly snapshot', () => {
  const snapshotAt = Date.parse('2026-11-05T00:00:00.000Z');

  it('keeps Micro, seven snapshot days, and 100 GB of storage', () => {
    expect(COMPUTE_SIZE).toBe('micro');
    expect(COMPUTE_MEMORY_MB).toBe(1024);
    expect(SNAPSHOT_RETENTION_DAYS).toBe(7);
    expect(STORAGE_INCLUDED_GB).toBe(100);
    expect(MEAL_MEDIA_BUCKET).toBe('meal-media');
    expect(PROFILE_IMAGE_BUCKET).toBe('profile-images');
  });

  it('drops orders and profile writes made after the snapshot for both roles', () => {
    const before = Date.parse('2026-11-04T18:00:00.000Z');
    const dinner = Date.parse('2026-11-05T23:30:00.000Z');
    expect(snapshotIncludes('database_row', before, snapshotAt)).toBe(true);
    expect(snapshotIncludes('database_row', dinner, snapshotAt)).toBe(false);
    expect(snapshotIncludes('database_row', snapshotAt, snapshotAt)).toBe(true);
    expect(snapshotIncludes('storage_object', before, snapshotAt)).toBe(false);
    expect(snapshotIncludes('database_row', Number.NaN, snapshotAt)).toBe(false);
  });
});
