import { lostPortionOrderCloses } from '../record-paid-order';
import { missingBuyerColumn, orderBuyerId, orderTotal } from '../order-row';
import { orderStatusAllowed, pickupConfirmedByBoth } from '../order-status';
import { orderCloseout } from '@/lib/order-closeout';
import { pickupTags } from '@/lib/meal-publish';

describe('lost portion refund', () => {
  it('closes the order only after the refund succeeds', () => {
    expect(lostPortionOrderCloses(false)).toBe(false);
    expect(lostPortionOrderCloses(true)).toBe(true);
  });
});

describe('order close-out', () => {
  it('lets the cook mark an accepted plate ready, then either person mark pickup', () => {
    expect(orderStatusAllowed('seller', 'accepted', 'ready')).toBe(true);
    expect(orderStatusAllowed('seller', 'preparing', 'ready')).toBe(true);
    expect(orderStatusAllowed('buyer', 'accepted', 'ready')).toBe(false);
    expect(orderStatusAllowed('buyer', 'pending', 'completed')).toBe(false);
    expect(orderStatusAllowed('buyer', 'pending', 'cancelled')).toBe(true);
    expect(orderStatusAllowed('buyer', 'accepted', 'cancelled')).toBe(false);
    expect(orderStatusAllowed('seller', 'pending', 'cancelled')).toBe(false);
    expect(orderStatusAllowed('seller', 'ready', 'completed')).toBe(true);
    expect(orderStatusAllowed('buyer', 'ready', 'completed')).toBe(true);
  });

  it('starts the payout clock only after both people confirm pickup', () => {
    expect(pickupConfirmedByBoth(['seller'])).toBe(false);
    expect(pickupConfirmedByBoth(['buyer'])).toBe(false);
    expect(pickupConfirmedByBoth(['seller', 'buyer'])).toBe(true);
  });

  it('names the button for the person holding the phone', () => {
    expect(orderCloseout('platemaker', 'accepted')?.label).toBe('Ready for pickup');
    expect(orderCloseout('platetaker', 'ready')?.next).toBe('completed');
    expect(orderCloseout('platetaker', 'pending')).toBeNull();
    expect(orderCloseout('platetaker', 'ready', true)).toBeNull();
    expect(orderCloseout('platemaker', 'ready', true)).toBeNull();
  });
});

describe('order row columns', () => {
  it('reads the live buyer column and a cents total', () => {
    expect(orderBuyerId({ platetaker_id: 'buyer-1' })).toBe('buyer-1');
    expect(orderBuyerId({ buyer_id: 'buyer-2', platetaker_id: 'other' })).toBe('buyer-2');
    expect(orderTotal({ total_price_cents: 1599 })).toBe(15.99);
    expect(missingBuyerColumn('column orders.buyer_id does not exist')).toBe(true);
    expect(missingBuyerColumn('permission denied')).toBe(false);
  });
});

describe('pickup tags', () => {
  it('saves a valid window and drops a broken one', () => {
    expect(pickupTags([
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 1, startTime: '18:00', endTime: '09:00' },
    ])).toEqual(['Mon 09:00-13:00']);
  });
});
