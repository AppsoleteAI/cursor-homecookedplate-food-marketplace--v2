import { hasMapPin, PICKUP_RADIUS_METERS, withinPickupRadius, type MapPin } from './pickup-radius';

type PinError = { code?: string; message?: string } | null | undefined;

type Admin = {
  from: (table: string) => any;
};

export function missingKitchenPinColumn(error: PinError): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || /kitchen_lat|kitchen_lng/.test(error.message || '');
}

export async function saveKitchenPin(admin: Admin, userId: string, lat: number, lng: number): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const saved = await admin.from('profiles').update({ kitchen_lat: lat, kitchen_lng: lng }).eq('id', userId);
  if (missingKitchenPinColumn(saved.error)) return;
  if (saved.error) console.error('[KitchenPin] The pin was not saved.', saved.error.message);
}

export async function readKitchenPins(
  admin: Admin,
  ids: string[],
): Promise<{ available: boolean; pins: Map<string, MapPin> }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { available: true, pins: new Map() };
  const result = await admin.from('profiles').select('id, kitchen_lat, kitchen_lng').in('id', unique);
  if (missingKitchenPinColumn(result.error)) return { available: false, pins: new Map() };
  const pins = new Map<string, MapPin>();
  for (const row of result.data || []) {
    pins.set(row.id, {
      lat: typeof row.kitchen_lat === 'number' ? row.kitchen_lat : null,
      lng: typeof row.kitchen_lng === 'number' ? row.kitchen_lng : null,
    });
  }
  return { available: true, pins };
}

export function pickupBounds(lat: number, lng: number) {
  const latPad = PICKUP_RADIUS_METERS / 111_320;
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngPad = PICKUP_RADIUS_METERS / (111_320 * Math.max(0.2, Math.abs(cos)));
  return {
    minLat: lat - latPad,
    maxLat: lat + latPad,
    minLng: lng - lngPad,
    maxLng: lng + lngPad,
  };
}

/** Cooks inside the buyer's 20 miles. available is false until the pin columns exist. */
export async function nearbyCookIds(
  admin: Admin,
  buyerId: string | null | undefined,
): Promise<{ available: boolean; ids: string[] }> {
  if (!buyerId) return { available: false, ids: [] };
  const buyer = await readKitchenPins(admin, [buyerId]);
  if (!buyer.available) return { available: false, ids: [] };
  const pin = buyer.pins.get(buyerId);
  if (!hasMapPin(pin)) return { available: true, ids: [] };
  const box = pickupBounds(pin.lat, pin.lng);
  const rows = await admin
    .from('profiles')
    .select('id, kitchen_lat, kitchen_lng')
    .gte('kitchen_lat', box.minLat)
    .lte('kitchen_lat', box.maxLat)
    .gte('kitchen_lng', box.minLng)
    .lte('kitchen_lng', box.maxLng);
  if (missingKitchenPinColumn(rows.error)) return { available: false, ids: [] };
  const ids = (rows.data || [])
    .filter((row: { kitchen_lat?: number | null; kitchen_lng?: number | null }) => withinPickupRadius(
      { lat: row.kitchen_lat, lng: row.kitchen_lng },
      pin,
    ))
    .map((row: { id: string }) => row.id);
  return { available: true, ids };
}

export type PickupGate =
  | { mode: 'metro' }
  | { mode: 'distance'; ok: true }
  | { mode: 'distance'; ok: false; message: string };

/** Distance check once the pin columns exist. Until that SQL is applied, callers keep the metro-name check. */
export async function pickupGate(admin: Admin, buyerId: string, cookIds: string[]): Promise<PickupGate> {
  const loaded = await readKitchenPins(admin, [buyerId, ...cookIds]);
  if (!loaded.available) return { mode: 'metro' };
  const buyer = loaded.pins.get(buyerId);
  if (!hasMapPin(buyer)) {
    return { mode: 'distance', ok: false, message: 'Get GPS before ordering a plate.' };
  }
  for (const cookId of cookIds) {
    const cook = loaded.pins.get(cookId);
    if (!hasMapPin(cook)) {
      return { mode: 'distance', ok: false, message: 'This kitchen has not saved a pickup location.' };
    }
    if (!withinPickupRadius(cook, buyer)) {
      return { mode: 'distance', ok: false, message: 'This plate is more than 20 miles from your saved location.' };
    }
  }
  return { mode: 'distance', ok: true };
}
