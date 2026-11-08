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

/** Columns an order list, a payment, or a status change reads. `buyer_id` is omitted when that column is not on the table. */
export const ORDER_LIST_COLUMNS = [
  'id',
  'meal_id',
  'buyer_id',
  'platetaker_id',
  'seller_id',
  'status',
  'quantity',
  'total_price',
  'total_price_cents',
  'paid',
  'payment_intent_id',
  'special_instructions',
  'instructions_status',
  'cooking_temperature',
  'allergies',
  'delivery_address',
  'pickup_time',
  'pickup_timezone',
  'estimated_completion_time',
  'created_at',
  'updated_at',
].join(', ');

export function orderListColumns(buyerColumn: 'buyer_id' | 'platetaker_id'): string {
  if (buyerColumn === 'buyer_id') return ORDER_LIST_COLUMNS;
  return ORDER_LIST_COLUMNS.replace('buyer_id, ', '');
}

type OrderRead = { data: any; error: { message?: string } | null };

/** Drops a column the database says is missing. Returns null when no named column can be removed. */
export function orderColumnsAfterError(columns: string, message: string | undefined): string | null {
  if (!message) return null;
  const next = columns
    .split(', ')
    .filter((name) => name.length > 0 && !new RegExp(`\\b${name}\\b`).test(message))
    .join(', ');
  if (next === columns || next.length === 0) return null;
  return next;
}

/** Reads an order with the named columns, then again without a column the database says is missing. */
export async function readOrderQuery(
  run: (columns: string) => PromiseLike<OrderRead>,
): Promise<OrderRead> {
  let current = orderListColumns('buyer_id');
  let result = await run(current);
  for (let attempt = 0; attempt < 6 && result.error; attempt += 1) {
    const next = orderColumnsAfterError(current, result.error.message);
    if (!next) return result;
    current = next;
    result = await run(current);
  }
  return result;
}
