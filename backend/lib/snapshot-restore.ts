/** Supabase Pro, compute size Micro. Point-in-time recovery stays off until revenue covers it. */
export const COMPUTE_SIZE = 'micro';
export const COMPUTE_MEMORY_MB = 1024;
export const SNAPSHOT_RETENTION_DAYS = 7;
export const STORAGE_INCLUDED_GB = 100;
export const MEAL_MEDIA_BUCKET = 'meal-media';
export const PROFILE_IMAGE_BUCKET = 'profile-images';

export type SnapshotKind = 'database_row' | 'storage_object';

/**
 * A nightly snapshot keeps database rows written at or before that snapshot.
 * Storage objects are not in the snapshot. A photo or clip deleted after the
 * snapshot is not returned by a database restore.
 */
export function snapshotIncludes(kind: SnapshotKind, writtenAtMs: number, snapshotAtMs: number): boolean {
  if (kind === 'storage_object') return false;
  if (!Number.isFinite(writtenAtMs) || !Number.isFinite(snapshotAtMs)) return false;
  return writtenAtMs <= snapshotAtMs;
}
