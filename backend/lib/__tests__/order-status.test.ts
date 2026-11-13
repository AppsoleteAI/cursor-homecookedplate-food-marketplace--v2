import { lostPortionOrderCloses, platePaymentCovers } from '../record-paid-order';
import { buyerCardCharge, buyerServiceFeePercent, calculateFees, orderTotalWithDelivery } from '../fees';
import { shopClearAllowed } from '../shop-order-status';
import { confirmedPaidIds, orderCancelPatch, orderHasHeldTransaction, orderPaidState, paymentIntentId, stripeSucceeded } from '../order-payment';
import { missingBuyerColumn, orderBuyerId, orderCookColumn, orderCookId, orderInsertShapeAfterError, orderListColumns, orderListFilterAfterError, orderPatchAfterError, orderTotal, plateInsertRow } from '../order-row';
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

  it('lets the cook clear a paid plate only after the buyer acknowledges receipt', () => {
    expect(orderCloseout('platemaker', 'ready')).toBeNull();
    expect(orderCloseout('platemaker', 'ready', false, true)?.next).toBe('completed');
    expect(orderCloseout('platetaker', 'ready')?.label).toBe('Send');
    expect(shopClearAllowed(false)).toBe(false);
    expect(shopClearAllowed(true)).toBe(true);
  });

  it('marks a plate paid only when the Stripe amount matches the cook price', () => {
    const base = 20;
    const percent = buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'free', baseAmount: base });
    const fees = calculateFees(base, percent, 10);
    const card = buyerCardCharge(orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, 0).buyerPays);
    const amountCents = Math.round(card.cardCharge * 100);
    expect(platePaymentCovers({
      orderIds: ['order-1'],
      bases: [base],
      deliveryFee: 0,
      amountCents,
      buyerRole: 'platetaker',
      buyerTier: 'free',
      listedOrderIds: ['order-1'],
      listedBaseCents: 2000,
    })).toBe(true);
    expect(platePaymentCovers({
      orderIds: ['order-1', 'order-2'],
      bases: [base, 40],
      deliveryFee: 0,
      amountCents,
      buyerRole: 'platetaker',
      buyerTier: 'free',
      listedOrderIds: ['order-1'],
      listedBaseCents: 2000,
    })).toBe(false);
    expect(platePaymentCovers({
      orderIds: ['order-1'],
      bases: [base],
      deliveryFee: 0,
      amountCents: 50,
      buyerRole: 'platetaker',
      buyerTier: 'free',
    })).toBe(false);
  });

  it('starts the payout clock only after both people confirm pickup', () => {
    expect(pickupConfirmedByBoth(['seller'])).toBe(false);
    expect(pickupConfirmedByBoth(['buyer'])).toBe(false);
    expect(pickupConfirmedByBoth(['seller', 'buyer'])).toBe(true);
  });

  it('names the button for the person holding the phone', () => {
    expect(orderCloseout('platemaker', 'accepted')?.label).toBe('Ready for pickup');
    expect(orderCloseout('platetaker', 'ready', false, false)?.next).toBe('completed');
    expect(orderCloseout('platetaker', 'pending')).toBeNull();
    expect(orderCloseout('platetaker', 'ready', true)).toBeNull();
    expect(orderCloseout('platemaker', 'ready', true)).toBeNull();
  });
});

describe('order row columns', () => {
  it('reads the live buyer column and a cents total', () => {
    expect(orderBuyerId({ platetaker_id: 'buyer-1' })).toBe('buyer-1');
    expect(orderBuyerId({ buyer_id: 'buyer-2', platetaker_id: 'other' })).toBe('buyer-2');
    expect(orderCookId({ platemaker_id: 'cook-1' })).toBe('cook-1');
    expect(orderCookColumn({ platemaker_id: 'cook-1' })).toBe('platemaker_id');
    expect(orderCookId({ seller_id: 'cook-2', platemaker_id: 'other' })).toBe('cook-2');
    expect(orderCookColumn({ seller_id: 'cook-2' })).toBe('seller_id');
    expect(orderTotal({ total_price_cents: 1599 })).toBe(15.99);
    expect(missingBuyerColumn('column orders.buyer_id does not exist')).toBe(true);
    expect(missingBuyerColumn('permission denied')).toBe(false);
  });

  it('treats a missing paid column as unpaid until Stripe or a held transaction', () => {
    expect(orderPaidState({})).toBe('absent');
    expect(orderPaidState({ paid: true })).toBe('paid');
    expect(orderPaidState({ paid: false })).toBe('unpaid');
    expect(paymentIntentId({ payment_intent_id: 'pi_123' })).toBe('pi_123');
    expect(paymentIntentId({ payment_intent_id: 'pi' })).toBeNull();
    expect(stripeSucceeded({ status: 'succeeded' })).toBe(true);
    expect(stripeSucceeded({ status: 'processing' })).toBe(false);
  });

  it('moves a cook list onto platemaker_id when seller_id and paid are missing', () => {
    const start = {
      cookColumn: 'seller_id' as const,
      requirePaid: true,
      buyerColumn: 'buyer_id' as const,
      columns: orderListColumns('buyer_id'),
    };
    const cook = orderListFilterAfterError(start, 'column orders.seller_id does not exist');
    expect(cook?.cookColumn).toBe('platemaker_id');
    const paid = orderListFilterAfterError(cook!, 'column orders.paid does not exist');
    expect(paid?.requirePaid).toBe(false);
    const dropped = orderListFilterAfterError(paid!, 'column orders.paid does not exist');
    expect(dropped?.columns.includes('paid')).toBe(false);
    expect(dropped?.requirePaid).toBe(false);
  });

  it('keeps a buyer list on platetaker_id without restoring seller_id', () => {
    const dropped = orderListFilterAfterError({
      cookColumn: 'platemaker_id',
      requirePaid: false,
      buyerColumn: 'buyer_id',
      columns: 'id, buyer_id, platetaker_id, platemaker_id',
    }, 'column orders.buyer_id does not exist');
    expect(dropped?.buyerColumn).toBe('platetaker_id');
    expect(dropped?.columns.includes('seller_id')).toBe(false);
  });

  it('writes a live plate insert when buyer, cook, price, and paid columns are missing', () => {
    const start = {
      buyerColumn: 'buyer_id' as const,
      cookColumn: 'seller_id' as const,
      priceColumn: 'total_price' as const,
      writePaid: true,
    };
    const buyer = orderInsertShapeAfterError(start, 'column orders.buyer_id does not exist');
    const cook = orderInsertShapeAfterError(buyer!, 'column orders.seller_id does not exist');
    const price = orderInsertShapeAfterError(cook!, 'column orders.total_price does not exist');
    const paid = orderInsertShapeAfterError(price!, 'column orders.paid does not exist');
    expect(plateInsertRow(paid!, {
      buyerId: 'buyer-1',
      cookId: 'cook-1',
      chargedBase: 15.5,
      paid: false,
      rest: { meal_id: 'meal-1', status: 'pending' },
    })).toEqual({
      meal_id: 'meal-1',
      status: 'pending',
      platetaker_id: 'buyer-1',
      platemaker_id: 'cook-1',
      total_price_cents: 1550,
    });
    expect(orderPatchAfterError({ status: 'cancelled', paid: false }, 'column orders.paid does not exist')).toEqual({
      status: 'cancelled',
    });
  });

  it('omits paid from a cancel when that column is absent', () => {
    expect(orderCancelPatch({})).toEqual({ status: 'cancelled' });
    expect(orderCancelPatch({ paid: true })).toEqual({ status: 'cancelled', paid: false });
    expect(orderCancelPatch({ paid: false })).toEqual({ status: 'cancelled', paid: false });
  });

  it('keeps a plate with a held transaction and leaves an unpaid plate out', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          in: () => ({
            in: async () => ({ data: [{ order_id: 'order-1' }], error: null }),
          }),
        }),
      }),
    };
    const ids = await confirmedPaidIds([
      { id: 'order-1', payment_intent_id: 'pi_123' },
      { id: 'order-2', paid: false, payment_intent_id: 'pi_456' },
      { id: 'order-3', paid: true },
    ], admin, undefined);
    expect(ids.has('order-1')).toBe(true);
    expect(ids.has('order-2')).toBe(false);
    expect(ids.has('order-3')).toBe(true);
  });

  it('reads a held or settled transaction as payment', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              limit: async () => ({ data: [{ id: 'txn-1' }], error: null }),
            }),
          }),
        }),
      }),
    };
    expect(await orderHasHeldTransaction(admin, 'order-1')).toBe(true);
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
