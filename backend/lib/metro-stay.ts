/** A different metro is saved only after the phone has been inside it for more than 30 minutes. */
export const METRO_STAY_MS = 30 * 60 * 1000;

/** A gap longer than two watch checks starts those 30 minutes over. */
export const METRO_STAY_GAP_MS = 10 * 60 * 1000;

export function stayIsReady(startedAt: string | undefined, now: number): boolean {
  if (!startedAt) return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && now - started > METRO_STAY_MS;
}

/** The first reading after a closed app does not finish the old stay. */
export function stayClockRestarts(lastSeenAt: string | undefined, now: number): boolean {
  if (!lastSeenAt) return true;
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return true;
  return now - seen > METRO_STAY_GAP_MS;
}
