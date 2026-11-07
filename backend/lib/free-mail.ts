/** Free Resend plan. A paid mail plan stays off until revenue covers it. */
export const FREE_EMAILS_PER_UTC_DAY = 100;
export const FREE_EMAILS_PER_MONTH = 3_000;

/**
 * One paid order mails the cook that payment arrived, then the buyer that it was
 * accepted, then the buyer that it is ready. Pickup mail is the fourth send,
 * counted by `MAIL_PER_PAID_ORDER` in `request-budget.ts`. Email notices default
 * to on, so these sends leave the same daily and monthly allowance.
 */
export const EMAILS_ON_PAID_ACCEPT_READY = 3;

export function plateTakerOrders(plateTakers: number, orderRate: number): number {
  if (!Number.isFinite(plateTakers) || !Number.isFinite(orderRate) || plateTakers < 0 || orderRate < 0) return 0;
  return Math.round(plateTakers * orderRate);
}

export function orderNoticeEmails(orders: number): number {
  if (!Number.isFinite(orders) || orders < 0) return 0;
  return Math.round(orders) * EMAILS_ON_PAID_ACCEPT_READY;
}

export function fitsFreeEmailDay(sends: number): boolean {
  return Number.isFinite(sends) && sends <= FREE_EMAILS_PER_UTC_DAY;
}

export function fitsFreeEmailMonth(sends: number): boolean {
  return Number.isFinite(sends) && sends <= FREE_EMAILS_PER_MONTH;
}
