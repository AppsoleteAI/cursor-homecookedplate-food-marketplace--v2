import {
  auditShopMatchesCombinedRefund,
  cancelledAuditShop,
  cancelledShopLines,
  nextShopStatus,
  shopCloseoutNotice,
  shopOrderMatchesCombinedRefund,
  shopRefundIsFull,
} from '../shop-order-status';

describe('shop order closeout', () => {
  it('accepts a pending order and completes an accepted one', () => {
    expect(nextShopStatus('pending', 'accept')).toBe('accepted');
    expect(nextShopStatus('accepted', 'complete')).toBe('completed');
    expect(nextShopStatus('pending', 'complete')).toBeNull();
    expect(nextShopStatus('completed', 'refund')).toBeNull();
  });

  it('returns the cook share before and after accept', () => {
    expect(shopRefundIsFull('pending')).toBe(false);
    expect(nextShopStatus('pending', 'refund')).toBe('cancelled');
    expect(shopRefundIsFull('accepted')).toBe(false);
    expect(nextShopStatus('accepted', 'refund')).toBe('cancelled');
  });

  it('tells the buyer when a shop order is completed', () => {
    expect(shopCloseoutNotice('complete').body).toBe('The cook completed your order.');
    expect(shopCloseoutNotice('accept').body).toBe('The cook accepted your order.');
    expect(shopCloseoutNotice('refund').body).toBe('This order was refunded.');
  });

  it('cancels only the refunded shop on a combined charge', () => {
    const farm = { items: [], fulfillment: { area: 'farm', sellerId: 'cook-1' }, sellerId: 'cook-1', status: 'pending' };
    const truck = { items: [], fulfillment: { area: 'food_truck', sellerId: 'cook-1' }, sellerId: 'cook-1', status: 'accepted' };
    expect(shopOrderMatchesCombinedRefund({
      lines: farm,
      rowShop: 'farm',
      area: 'farm',
      areaShop: 'farm',
      sellerId: 'cook-1',
    })).toBe(true);
    expect(shopOrderMatchesCombinedRefund({
      lines: truck,
      rowShop: 'food_truck',
      area: 'farm',
      areaShop: 'farm',
      sellerId: 'cook-1',
    })).toBe(false);
    const older = { items: [], fulfillment: { area: 'meal_prep', sellerId: 'cook-2' } };
    expect(shopOrderMatchesCombinedRefund({
      lines: older,
      rowShop: 'meal_prep',
      area: 'meal_prep',
      areaShop: 'meal_prep',
      sellerId: 'cook-2',
    })).toBe(true);
    expect(cancelledShopLines(farm).status).toBe('cancelled');
    const audit = { seller_id: 'cook-1', area: 'catering', lines: { items: [] }, paid: true, payment_intent_id: 'pi' };
    expect(auditShopMatchesCombinedRefund(audit, 'catering', 'cook-1')).toBe(true);
    expect(auditShopMatchesCombinedRefund(audit, 'sit_down', 'cook-1')).toBe(false);
    expect(cancelledAuditShop(audit).paid).toBe(false);
  });
});
