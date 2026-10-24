/** A phone GPS fix inside this radius is the one Get GPS may save. */
export const PRECISE_METERS = 100;

/** Indoor GPS is often wider than 100m and still the right city. A cell fix is not. */
export const ACCEPT_METERS = 300;

/** Ignore a cached point. Android and iOS both hand those out as the first sample. */
export const MAX_FIX_AGE_MS = 15_000;

export type FixQuality = 'precise' | 'usable' | 'reject';

export function pointIsPlausible(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * A continental US reading with latitude and longitude reversed.
 * A real US point is never in that shape, so this does not move a good fix.
 */
export function normalizeUsPoint(lat: number, lng: number): { lat: number; lng: number } {
  const latLooksLikeUsLng = lat <= -66 && lat >= -125;
  const lngLooksLikeUsLat = lng >= 24 && lng <= 49;
  const alreadyUs = lat >= 24 && lat <= 49 && lng <= -66 && lng >= -125;
  if (latLooksLikeUsLng && lngLooksLikeUsLat && !alreadyUs) {
    return { lat: lng, lng: lat };
  }
  return { lat, lng };
}

export function fixAgeMs(timestamp: number, now = Date.now()): number {
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  const ms = timestamp > 0 && timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return Math.abs(now - ms);
}

export function fixQuality(input: {
  lat: number;
  lng: number;
  accuracy: number | null | undefined;
  ageMs: number;
}): FixQuality {
  if (!pointIsPlausible(input.lat, input.lng)) return 'reject';
  if (typeof input.accuracy !== 'number' || !Number.isFinite(input.accuracy) || input.accuracy < 1) return 'reject';
  if (!Number.isFinite(input.ageMs) || input.ageMs > MAX_FIX_AGE_MS) return 'reject';
  if (input.accuracy <= PRECISE_METERS) return 'precise';
  if (input.accuracy <= ACCEPT_METERS) return 'usable';
  return 'reject';
}
