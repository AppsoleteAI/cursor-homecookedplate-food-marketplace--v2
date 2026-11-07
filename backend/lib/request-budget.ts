/**
 * One free Workers day and one free mail day for every role.
 * Kitchen, home, and checkout spend the same request ceiling.
 */
export const SHARED_DAILY_REQUEST_CAP = 100_000;
export const SHARED_DAILY_EMAIL_CAP = 100;
export const SCALE_DAILY_COOKS = 5_000;
export const SCALE_DAILY_BUYERS = 5_000;

export function dailyRequestRoom(spent: {
  kitchen: number;
  homeAndCheckout: number;
  other: number;
}): number {
  const counts = [spent.kitchen, spent.homeAndCheckout, spent.other];
  if (counts.some((count) => !Number.isFinite(count) || count < 0)) {
    throw new Error('Request counts must be finite and zero or more.');
  }
  return SHARED_DAILY_REQUEST_CAP - counts.reduce((sum, count) => sum + count, 0);
}

/** Paid-order mail to the cook, then accept, ready, and pickup mail. */
export const MAIL_PER_PAID_ORDER = 4;

export function orderMailFits(orders: number, alreadySent = 0): boolean {
  if (!Number.isFinite(orders) || orders < 0 || !Number.isFinite(alreadySent) || alreadySent < 0) {
    throw new Error('Mail counts must be finite and zero or more.');
  }
  return alreadySent + orders * MAIL_PER_PAID_ORDER <= SHARED_DAILY_EMAIL_CAP;
}
