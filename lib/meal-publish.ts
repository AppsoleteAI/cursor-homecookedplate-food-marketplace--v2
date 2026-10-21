export function canPublishMeal(input: {
  name: string;
  price: number;
  photoCount: number;
  preparationMinutes: number;
  foodSafetyAcknowledged: boolean;
}): boolean {
  return (
    input.name.trim().length > 0 &&
    Number.isFinite(input.price) &&
    input.price > 0 &&
    input.photoCount >= 1 &&
    Number.isInteger(input.preparationMinutes) &&
    input.preparationMinutes >= 1 &&
    input.preparationMinutes <= 600 &&
    input.foodSafetyAcknowledged
  );
}

const PICKUP_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PICKUP_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Pickup windows saved on the plate. A window that is not a real clock range is left off. */
export function pickupTags(windows: { dayOfWeek: number; startTime: string; endTime: string }[]): string[] {
  return windows.flatMap((window) => {
    if (!Number.isInteger(window.dayOfWeek) || window.dayOfWeek < 0 || window.dayOfWeek > 6) return [];
    if (!PICKUP_TIME.test(window.startTime) || !PICKUP_TIME.test(window.endTime)) return [];
    if (window.startTime >= window.endTime) return [];
    return [`${PICKUP_DAYS[window.dayOfWeek]} ${window.startTime}-${window.endTime}`];
  });
}

const WINDOW_TAG = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) ((?:[01]\d|2[0-3]):[0-5]\d)-((?:[01]\d|2[0-3]):[0-5]\d)$/;

export function timeZoneTag(zone: string | null | undefined): string | null {
  const name = (zone || '').trim();
  if (!name || name.length > 80) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
  } catch {
    return null;
  }
  return `tz:${name}`;
}

/** The cook's clock saved with the pickup days. Missing means the window is not checked in the buyer's clock. */
export function cookTimeZoneFromTags(tags: string[] | null | undefined): string | null {
  const found = (tags || []).find((tag) => tag.startsWith('tz:'));
  return timeZoneTag(found?.slice(3))?.slice(3) ?? null;
}

/** Pickup days saved before a cook time zone cannot be checked. UTC is not that clock. */
export function pickupWindowNeedsCookZone(tags: string[] | null | undefined): boolean {
  const hasWindow = (tags || []).some((tag) => WINDOW_TAG.test(tag));
  return hasWindow && cookTimeZoneFromTags(tags) == null;
}

export function portionTag(count: number): string {
  const portions = Math.round(count);
  const safe = Number.isInteger(portions) && portions >= 1 && portions <= 100 ? portions : 1;
  return `portions:${safe}`;
}

/** An open order holds a portion. A completed or cancelled order does not. */
export function portionStatusHolds(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'accepted' || status === 'preparing' || status === 'ready';
}

/** A paid open order holds a portion. An unpaid checkout does not. */
export function portionRowHolds(row: { status?: string | null; paid?: boolean | null }): boolean {
  return row.paid === true && portionStatusHolds(row.status);
}

/** A plate with no saved count has one portion, so a second buyer cannot pay for it. */
export function portionsFromTags(tags: string[] | null | undefined): number {
  const found = (tags || []).find((tag) => /^portions:\d+$/.test(tag));
  if (!found) return 1;
  const portions = Number(found.slice('portions:'.length));
  return portions >= 1 && portions <= 100 ? portions : 1;
}

function clockMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

/** True when the plate saved no pickup days, or this time sits inside one saved window. */
export function pickupFitsWindow(tags: string[] | null | undefined, when: Date, timeZone?: string | null): boolean {
  const windows = (tags || []).flatMap((tag) => {
    const match = WINDOW_TAG.exec(tag);
    if (!match) return [];
    return [{ day: match[1], start: clockMinutes(match[2]), end: clockMinutes(match[3]) }];
  });
  if (windows.length === 0) return true;
  if (Number.isNaN(when.getTime())) return false;
  const zone = timeZoneTag(timeZone)?.slice(3);
  if (!zone) return false;
  let weekday = '';
  let minutes = -1;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(when);
    weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    minutes = hour * 60 + minute;
  } catch {
    return false;
  }
  return windows.some((window) => window.day === weekday && minutes >= window.start && minutes < window.end);
}

export function cuisineToMealCategory(cuisine: string): 'dinner' | 'dessert' {
  return cuisine.trim() === 'Bakery' ? 'dessert' : 'dinner';
}

export function parseIngredientList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}
