/** Read the buyer id from either the repo column or the live column. */
export function orderBuyerId(order: { buyer_id?: string | null; platetaker_id?: string | null }): string {
  return order.buyer_id || order.platetaker_id || '';
}

/** Read the plate base from total_price, or from cents when that is the live column. */
export function orderTotal(order: { total_price?: unknown; total_price_cents?: unknown }): number {
  if (order.total_price != null && order.total_price !== '') {
    const value = parseFloat(String(order.total_price));
    if (Number.isFinite(value)) return value;
  }
  if (order.total_price_cents != null && order.total_price_cents !== '') {
    const cents = Number(order.total_price_cents);
    if (Number.isFinite(cents)) return cents / 100;
  }
  return 0;
}

export function missingBuyerColumn(message: string | undefined): boolean {
  return typeof message === 'string' && /column/i.test(message) && /buyer_id/.test(message);
}
