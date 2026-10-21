import { shopFulfillmentSchema, type ShopFulfillment } from '@/backend/lib/shop-fulfillment';
import { assertShopHandoff } from '@/lib/combined-handoff';
import { combinedChargeKey, payableCheckouts, type CombinedCheckoutDraft } from '@/lib/gather-combined-checkouts';

const farm: ShopFulfillment = { shop: 'farm', channel: 'hand_delivery' };
const truck: ShopFulfillment = { shop: 'food_truck', truckId: 'corner-cart', truckName: 'Corner Cart', pickupSlot: 'In 30 minutes' };
const prep: ShopFulfillment = {
  shop: 'meal_prep',
  cookId: 'weekday-table',
  cookName: 'Weekday Table',
  handoff: 'dropoff',
  windowLabel: 'Sunday 3:00–5:00 · Household drop-off in town',
  address: '12 Oak Street',
  mix: 'Mostly ready',
};
const catering: ShopFulfillment = {
  shop: 'catering',
  companyId: 'harbor-table',
  companyName: 'Harbor Table',
  organization: 'Harbor office',
  dropoffWindow: 'Weekday lunch, 11:00–1:00',
  address: '64 King Street',
};
const table: ShopFulfillment = { shop: 'sit_down', placeId: 'blue-window', placeName: 'Blue Window', service: 'sit_down', partySize: 4 };
const takeout: ShopFulfillment = { shop: 'sit_down', placeId: 'lane-ghost', placeName: 'Lane Kitchen', service: 'takeout', partySize: 1 };

function picked<T extends ShopFulfillment['shop']>(
  value: ShopFulfillment | null,
  shop: T,
): Extract<ShopFulfillment, { shop: T }> | undefined {
  if (!value || value.shop !== shop) return undefined;
  return value as Extract<ShopFulfillment, { shop: T }>;
}

function draft(area: CombinedCheckoutDraft['area'], sellerId = ''): CombinedCheckoutDraft {
  return { area, sellerId, sellerName: 'Seller', lines: [{ productId: 'item', quantity: 1 }] };
}

describe('combined checkout handoff', () => {
  it('keeps the handoff the buyer chose for each shop area', () => {
    expect(picked(assertShopHandoff('farm', farm), 'farm')?.channel).toBe('hand_delivery');
    expect(picked(assertShopHandoff('food_truck', truck), 'food_truck')?.pickupSlot).toBe('In 30 minutes');
    expect(picked(assertShopHandoff('food_cart', truck), 'food_truck')?.shop).toBe('food_truck');
    expect(picked(assertShopHandoff('meal_prep', prep), 'meal_prep')?.address).toBe('12 Oak Street');
    expect(picked(assertShopHandoff('catering', catering), 'catering')?.dropoffWindow).toBe('Weekday lunch, 11:00–1:00');
    expect(picked(assertShopHandoff('sit_down', table), 'sit_down')?.partySize).toBe(4);
    expect(picked(assertShopHandoff('ghost_kitchen', takeout), 'sit_down')?.service).toBe('takeout');
    expect(assertShopHandoff('home', undefined)).toBeNull();
  });

  it('rejects a missing handoff, a plate handoff, and a table at a ghost kitchen', () => {
    expect(() => assertShopHandoff('farm', undefined)).toThrow('Choose a pickup');
    expect(() => assertShopHandoff('home', farm)).toThrow('plate checkout');
    expect(() => assertShopHandoff('ghost_kitchen', table)).toThrow('no table');
    expect(shopFulfillmentSchema.safeParse({ ...prep, address: 'short' }).success).toBe(false);
  });

  it('sends the chosen handoff with the charge, including a catalog seller', () => {
    const seller = '11111111-1111-4111-8111-111111111111';
    const paid = payableCheckouts(
      [draft('food_cart'), draft('farm', seller), draft('home', seller)],
      { [combinedChargeKey('food_cart', '')]: truck, [combinedChargeKey('farm', seller)]: farm },
    );
    expect(paid[0]?.handoff).toEqual(truck);
    expect(paid[0]?.sellerId).toBeUndefined();
    expect(paid[1]?.handoff).toEqual(farm);
    expect(paid[2]?.handoff).toBeUndefined();
    expect(combinedChargeKey('food_cart', '')).toBe('food_cart:food_cart');
  });

  it('sends the plate pickup and delivery address with the home charge', () => {
    const seller = '11111111-1111-4111-8111-111111111111';
    const paid = payableCheckouts(
      [{
        area: 'home',
        sellerId: seller,
        sellerName: 'Ada',
        lines: [{
          productId: 'plate-1',
          quantity: 2,
          pickupTime: '2026-10-21T18:00:00.000Z',
          pickupTimeZone: 'America/New_York',
          specialInstructions: 'No onions',
        }],
      }],
      {},
      { [seller]: '12 Oak Street' },
    );
    expect(paid[0]?.deliveryAddress).toBe('12 Oak Street');
    expect(paid[0]?.lines[0]).toMatchObject({
      pickupTime: '2026-10-21T18:00:00.000Z',
      pickupTimeZone: 'America/New_York',
      specialInstructions: 'No onions',
      quantity: 2,
    });
  });
});
