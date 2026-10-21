import type { SavedShopOrder } from '@/backend/lib/shop-fulfillment';
import { COMBINED_HANDOFF } from '@/backend/lib/shop-fulfillment';
import {
  caterOrdersFromSaved,
  farmOrdersFromSaved,
  prepOrdersFromSaved,
  sitOrdersFromSaved,
  truckOrdersFromSaved,
} from '../saved-shop-order';

function combined(shop: SavedShopOrder['shop'], area: string): SavedShopOrder {
  return {
    id: `${shop}-1`,
    shop,
    createdAt: '2026-10-10T18:00:00.000Z',
    baseAmount: 20,
    buyerPays: 22,
    sellerPayout: 18,
    items: [{ productId: 'item-1', name: 'Plate', quantity: 1, unitPrice: 20 }],
    fulfillment: { shop, combined: true, sellerId: 'cook-1', sellerName: 'Ada', area },
    paid: true,
    sellerId: 'cook-1',
    orderStatus: 'pending',
  };
}

describe('combined shop orders on each lane screen', () => {
  it('shows the paid order without a handoff the buyer did not choose', () => {
    expect(farmOrdersFromSaved([combined('farm', 'farm')])[0]?.handoffNote).toBe(COMBINED_HANDOFF);
    expect(prepOrdersFromSaved([combined('meal_prep', 'meal_prep')])[0]?.handoffNote).toBe(COMBINED_HANDOFF);
    expect(truckOrdersFromSaved([combined('food_truck', 'food_cart')])[0]?.handoffNote).toBe(COMBINED_HANDOFF);
    expect(caterOrdersFromSaved([combined('catering', 'catering')])[0]?.handoffNote).toBe(COMBINED_HANDOFF);
    expect(sitOrdersFromSaved([combined('sit_down', 'ghost_kitchen')])[0]?.handoffNote).toBe(COMBINED_HANDOFF);
    expect(truckOrdersFromSaved([combined('farm', 'farm')])).toEqual([]);
  });

  it('shows the pickup, drop-off, or table chosen on a combined charge', () => {
    const farm = farmOrdersFromSaved([{
      ...combined('farm', 'farm'),
      fulfillment: { shop: 'farm', channel: 'hand_delivery' },
    }])[0];
    expect(farm?.channel).toBe('hand_delivery');
    expect(farm?.handoffNote).toBeUndefined();

    const cart = truckOrdersFromSaved([{
      ...combined('food_truck', 'food_cart'),
      fulfillment: { shop: 'food_truck', truckId: 'corner-cart', truckName: 'Corner Cart', pickupSlot: 'In 30 minutes' },
    }])[0];
    expect(cart?.pickupSlot).toBe('In 30 minutes');
    expect(cart?.handoffNote).toBeUndefined();

    const kitchen = sitOrdersFromSaved([{
      ...combined('sit_down', 'ghost_kitchen'),
      fulfillment: { shop: 'sit_down', placeId: 'lane-ghost', placeName: 'Lane Kitchen', service: 'takeout', partySize: 1 },
    }])[0];
    expect(kitchen?.service).toBe('takeout');
    expect(kitchen?.partySize).toBe(1);
    expect(kitchen?.handoffNote).toBeUndefined();
  });
});
