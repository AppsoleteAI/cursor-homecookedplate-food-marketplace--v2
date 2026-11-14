/** Read the buyer id from either the repo column or the live column. */
export function orderBuyerId(order: { buyer_id?: string | null; platetaker_id?: string | null }): string {
  return order.buyer_id || order.platetaker_id || '';
}

/** Read the cook id from seller_id, or from platemaker_id when that is the live column. */
export function orderCookId(order: { seller_id?: string | null; platemaker_id?: string | null }): string {
  return order.seller_id || order.platemaker_id || '';
}

/** The cook column that holds this row's cook id. The live table uses platemaker_id. */
export function orderCookColumn(order: { seller_id?: string | null; platemaker_id?: string | null }): 'seller_id' | 'platemaker_id' {
  return order.seller_id ? 'seller_id' : 'platemaker_id';
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
  return missingOrderColumn(message, 'buyer_id');
}

export function missingOrderColumn(message: string | undefined, column: string): boolean {
  return typeof message === 'string' && /column/i.test(message) && new RegExp(`\\b${column}\\b`).test(message);
}

export type OrderListFilter = {
  cookColumn: 'seller_id' | 'platemaker_id';
  requirePaid: boolean;
  buyerColumn: 'buyer_id' | 'platetaker_id';
  columns: string;
};

/** Moves a list off seller_id or paid when the database says that column is missing. */
export function orderListFilterAfterError(filter: OrderListFilter, message: string | undefined): OrderListFilter | null {
  if (!message) return null;
  if (missingOrderColumn(message, 'seller_id') && filter.cookColumn === 'seller_id') {
    return { ...filter, cookColumn: 'platemaker_id' };
  }
  if (missingOrderColumn(message, 'paid') && filter.requirePaid) {
    return { ...filter, requirePaid: false };
  }
  if (missingBuyerColumn(message) && filter.buyerColumn === 'buyer_id') {
    const columns = filter.columns.replace('buyer_id, ', '').replace(', buyer_id', '');
    if (columns === filter.columns) return null;
    return { ...filter, buyerColumn: 'platetaker_id', columns };
  }
  const next = orderColumnsAfterError(filter.columns, message);
  if (!next) return null;
  return { ...filter, columns: next };
}

/** Columns an order list, a payment, or a status change reads. `buyer_id` is omitted when that column is not on the table. */
export const ORDER_LIST_COLUMNS = [
  'id',
  'meal_id',
  'buyer_id',
  'platetaker_id',
  'seller_id',
  'platemaker_id',
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

export type OrderInsertShape = {
  buyerColumn: 'buyer_id' | 'platetaker_id';
  cookColumn: 'seller_id' | 'platemaker_id';
  priceColumn: 'total_price' | 'total_price_cents';
  writePaid: boolean;
};

/** Drops a missing insert column and uses the live name for the buyer, the cook, or the price. */
export function orderInsertShapeAfterError(shape: OrderInsertShape, message: string | undefined): OrderInsertShape | null {
  if (!message) return null;
  if (missingOrderColumn(message, 'buyer_id') && shape.buyerColumn === 'buyer_id') {
    return { ...shape, buyerColumn: 'platetaker_id' };
  }
  if (missingOrderColumn(message, 'seller_id') && shape.cookColumn === 'seller_id') {
    return { ...shape, cookColumn: 'platemaker_id' };
  }
  if (missingOrderColumn(message, 'total_price') && shape.priceColumn === 'total_price') {
    return { ...shape, priceColumn: 'total_price_cents' };
  }
  if (missingOrderColumn(message, 'paid') && shape.writePaid) {
    return { ...shape, writePaid: false };
  }
  return null;
}

/** One plate insert. The price is dollars in total_price and cents in total_price_cents. */
export function plateInsertRow(
  shape: OrderInsertShape,
  fields: {
    buyerId: string;
    cookId: string;
    chargedBase: number;
    paid: boolean;
    rest: Record<string, unknown>;
  },
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    ...fields.rest,
    [shape.buyerColumn]: fields.buyerId,
    [shape.cookColumn]: fields.cookId,
    [shape.priceColumn]: shape.priceColumn === 'total_price_cents'
      ? Math.round(fields.chargedBase * 100)
      : fields.chargedBase,
  };
  if (shape.writePaid) row.paid = fields.paid;
  return row;
}

/** Removes one missing column from an update. A cancel can keep status after paid is dropped. */
export function orderPatchAfterError(
  patch: Record<string, unknown>,
  message: string | undefined,
): Record<string, unknown> | null {
  if (!message) return null;
  const key = Object.keys(patch).find((column) => missingOrderColumn(message, column));
  if (!key) return null;
  const next = { ...patch };
  delete next[key];
  return Object.keys(next).length > 0 ? next : null;
}

export async function writeOrderPatch(
  run: (patch: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }>,
  patch: Record<string, unknown>,
): Promise<{ error: { message?: string } | null }> {
  let current = patch;
  let result = await run(current);
  for (let attempt = 0; attempt < 4 && result.error; attempt += 1) {
    const next = orderPatchAfterError(current, result.error.message);
    if (!next) return result;
    current = next;
    result = await run(current);
  }
  return result;
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
