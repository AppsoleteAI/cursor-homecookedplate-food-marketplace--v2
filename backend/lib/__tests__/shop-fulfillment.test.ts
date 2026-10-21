import { packShopLines, presentSavedShopOrder, shopFulfillmentSchema } from '../shop-fulfillment';

describe('shop orders saved after card payment', () => {
  const lines = [{ productId: 'hearth-apples', name: 'Apples', quantity: 2, unitPrice: 28 }];

  it('keeps the priced lines and stores the farm handoff', () => {
    const packed = packShopLines(lines, { shop: 'farm', channel: 'farm_pickup' });
    expect(packed.items).toEqual(lines);
    expect(packed.fulfillment).toEqual({ shop: 'farm', channel: 'farm_pickup' });
  });

  it('reads a paid shop order back from the packed row', () => {
    const packed = packShopLines(lines, {
      shop: 'food_truck',
      truckId: 'lane-1',
      truckName: 'Lane',
      pickupSlot: 'Next 15 minutes',
    });
    const saved = presentSavedShopOrder({
      id: 'order-1',
      shop: 'food_truck',
      lines: packed,
      base_amount: 56,
      total_charge: 61.6,
      created_at: '2026-10-10T18:00:00.000Z',
    });
    expect(saved?.id).toBe('order-1');
    expect(saved?.buyerPays).toBe(61.6);
    expect(saved?.sellerPayout).toBe(50.4);
    expect(saved?.fulfillment).toMatchObject({ truckName: 'Lane' });
  });

  it('shows a combined checkout on that shop order screen', () => {
    const farm = presentSavedShopOrder({
      id: 'combined-farm',
      shop: 'farm',
      lines: {
        items: lines,
        fulfillment: { area: 'farm', sellerId: 'cook-1', sellerName: 'Ada', combined: true },
        sellerId: 'cook-1',
        status: 'pending',
      },
      base_amount: 56,
      total_charge: 61.6,
      created_at: '2026-10-10T18:00:00.000Z',
      paid: true,
    });
    expect(farm?.shop).toBe('farm');
    expect(farm?.sellerId).toBe('cook-1');
    expect(farm?.orderStatus).toBe('pending');
    expect(farm?.fulfillment).toMatchObject({ combined: true, sellerName: 'Ada' });

    const cart = presentSavedShopOrder({
      id: 'combined-cart',
      shop: 'food_truck',
      lines: { items: lines, fulfillment: { area: 'food_cart', sellerId: 'cook-2' }, status: 'accepted' },
      base_amount: 10,
      total_charge: 11,
      created_at: '2026-10-10T18:00:00.000Z',
      paid: true,
    });
    expect(cart?.shop).toBe('food_truck');
    expect(cart?.sellerId).toBe('cook-2');

    const ghost = presentSavedShopOrder({
      id: 'combined-ghost',
      shop: 'sit_down',
      lines: { items: lines, fulfillment: { area: 'ghost_kitchen', sellerId: 'cook-3', sellerName: 'Night kitchen' } },
      base_amount: 10,
      total_charge: 11,
      created_at: '2026-10-10T18:00:00.000Z',
      paid: true,
    });
    expect(ghost?.shop).toBe('sit_down');
    expect(ghost?.fulfillment).toMatchObject({ sellerName: 'Night kitchen', area: 'ghost_kitchen' });
  });

  it('ignores a phone-only row that has no handoff', () => {
    expect(presentSavedShopOrder({
      id: 'local',
      shop: 'farm',
      lines,
      base_amount: 10,
      total_charge: 11,
      created_at: '2026-10-10T18:00:00.000Z',
    })).toBeNull();
  });

  it('requires a drop-off address for a prep week', () => {
    const parsed = shopFulfillmentSchema.safeParse({
      shop: 'meal_prep',
      cookId: 'cook-1',
      cookName: 'Ada',
      handoff: 'dropoff',
      windowLabel: 'Tuesday 4–6',
      address: 'short',
      mix: 'Ready meals',
    });
    expect(parsed.success).toBe(false);
  });

  it('holds a table for one when the order is takeout', () => {
    const parsed = shopFulfillmentSchema.parse({
      shop: 'sit_down',
      placeId: 'cafe-1',
      placeName: 'Cafe',
      service: 'takeout',
      partySize: 4,
    });
    if (parsed.shop !== 'sit_down') throw new Error('expected a sit-down order');
    expect(parsed.partySize).toBe(1);
  });
});
