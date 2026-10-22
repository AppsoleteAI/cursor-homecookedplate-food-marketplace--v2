import type { SupabaseClient } from '@supabase/supabase-js';
import { priceShopOrder } from '../shop-quote';

function adminFor(listing: Record<string, unknown> | null, offers: Record<string, unknown>[]) {
  const filter = {
    eq() { return filter; },
    order() { return filter; },
    limit: async () => ({ data: offers, error: null }),
    maybeSingle: async () => ({ data: listing ? { listing } : null, error: null }),
  };
  return {
    from() {
      return { select: () => filter };
    },
  } as unknown as SupabaseClient;
}

describe('priceShopOrder', () => {
  it('prices a cook listing and applies a 50 percent offer', async () => {
    const admin = adminFor(
      { name: 'Jar of honey', price: 12 },
      [{
        id: 'offer-1',
        listing_id: 'listing-honey',
        type: 'percentage',
        title: 'Half',
        description: 'Half off',
        discount_percentage: 50,
        start_date: '2020-01-01T00:00:00.000Z',
        end_date: '2099-01-01T00:00:00.000Z',
        is_active: true,
      }],
    );
    const quote = await priceShopOrder(admin, 'farm', [{ productId: 'listing-honey', quantity: 2 }], '11111111-1111-4111-8111-111111111111');
    expect(quote.baseAmount).toBe(12);
    expect(quote.lines[0].lineTotal).toBe(12);
  });

  it('refuses a fixed amount that lands on zero', async () => {
    const admin = adminFor(
      { name: 'Soup', price: 8 },
      [{
        id: 'offer-2',
        listing_id: 'listing-soup',
        type: 'fixed-amount',
        title: 'Off',
        description: 'Off',
        discount_amount: 100,
        start_date: '2020-01-01T00:00:00.000Z',
        end_date: '2099-01-01T00:00:00.000Z',
        is_active: true,
      }],
    );
    await expect(priceShopOrder(admin, 'meal_prep', [{ productId: 'listing-soup', quantity: 1 }], '11111111-1111-4111-8111-111111111111'))
      .rejects.toThrow(/zero/);
  });

  it('refuses a listing the server does not have', async () => {
    const admin = adminFor(null, []);
    await expect(priceShopOrder(admin, 'farm', [{ productId: 'listing-local', quantity: 1 }], '11111111-1111-4111-8111-111111111111'))
      .rejects.toThrow(/server menu/);
  });
});
