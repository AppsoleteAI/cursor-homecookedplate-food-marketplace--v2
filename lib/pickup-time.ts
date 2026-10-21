/** Show a pickup instant in the time zone saved with the order. */
export function formatPickupTime(value: string | Date | null | undefined, timeZone?: string | null): string {
  if (!value) return 'No pickup time was chosen.';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No pickup time was chosen.';
  if (!timeZone) return date.toLocaleString();
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/** A reorder keeps a pickup time only when that time is still ahead. */
export function reorderPickup(when: Date | string | null | undefined, now = Date.now()): Date | undefined {
  if (!when) return undefined;
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now) return undefined;
  return date;
}

export function deviceTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.length > 0 ? zone : undefined;
  } catch {
    return undefined;
  }
}
