export type ShopCloseoutAction = 'accept' | 'refund' | 'complete';

export function nextShopStatus(current: string, action: ShopCloseoutAction): 'accepted' | 'cancelled' | 'completed' | null {
  if (action === 'accept' && current === 'pending') return 'accepted';
  if (action === 'refund' && (current === 'pending' || current === 'accepted')) return 'cancelled';
  if (action === 'complete' && current === 'accepted') return 'completed';
  return null;
}

/** A shop refund returns the cook's share, the same amount as a plate cancel. */
export function shopRefundIsFull(_current: string): boolean {
  return false;
}

export function shopCloseoutNotice(action: ShopCloseoutAction): { title: string; body: string } {
  if (action === 'accept') return { title: 'Order accepted', body: 'The cook accepted your order.' };
  if (action === 'complete') return { title: 'Order update', body: 'The cook completed your order.' };
  return { title: 'Order update', body: 'This order was refunded.' };
}

function shopRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function shopCheckoutSellerId(lines: unknown): string | null {
  const row = shopRecord(lines);
  if (!row) return null;
  if (typeof row.sellerId === 'string') return row.sellerId;
  const fulfillment = shopRecord(row.fulfillment);
  return fulfillment && typeof fulfillment.sellerId === 'string' ? fulfillment.sellerId : null;
}

export function shopCheckoutArea(lines: unknown): string | null {
  const fulfillment = shopRecord(shopRecord(lines)?.fulfillment);
  if (!fulfillment) return null;
  if (typeof fulfillment.area === 'string') return fulfillment.area;
  if (typeof fulfillment.shop === 'string') return fulfillment.shop;
  return null;
}

/** One card can hold several shops. Only the refunded area and cook is closed. */
export function shopOrderMatchesCombinedRefund(input: {
  lines: unknown;
  rowShop: string | null;
  area: string;
  areaShop: string | null;
  sellerId: string;
}): boolean {
  if (shopCheckoutSellerId(input.lines) !== input.sellerId) return false;
  const area = shopCheckoutArea(input.lines);
  if (area) return area === input.area || (input.areaShop != null && area === input.areaShop);
  return input.rowShop != null && input.areaShop != null && input.rowShop === input.areaShop;
}

export function cancelledShopLines(lines: unknown): Record<string, unknown> {
  const row = shopRecord(lines);
  return {
    items: Array.isArray(row?.items) ? row.items : Array.isArray(lines) ? lines : [],
    fulfillment: row?.fulfillment,
    sellerId: shopCheckoutSellerId(lines),
    status: 'cancelled',
  };
}

export function auditShopMatchesCombinedRefund(data: unknown, area: string, sellerId: string): boolean {
  const row = shopRecord(data);
  if (!row) return false;
  const seller = typeof row.seller_id === 'string' ? row.seller_id : shopCheckoutSellerId(row.lines);
  const storedArea = typeof row.area === 'string' ? row.area : shopCheckoutArea(row.lines);
  return seller === sellerId && storedArea === area;
}

export function cancelledAuditShop(data: unknown): Record<string, unknown> {
  const row = shopRecord(data) ?? {};
  return {
    ...row,
    paid: false,
    lines: cancelledShopLines(row.lines),
  };
}
