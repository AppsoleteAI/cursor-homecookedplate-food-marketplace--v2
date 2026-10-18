import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useStripe } from '@/lib/stripe';
import type { ShopName } from '@/backend/lib/shop-catalog';
import { fulfillmentIsDelivery } from '@/backend/lib/delivery-fee';
import type { ShopFulfillment } from '@/backend/lib/shop-fulfillment';

type ShopLine = { productId: string; quantity: number };

const OFFERING_OWNER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function offeringOwnerId(fulfillment: ShopFulfillment): string | undefined {
  const raw = 'cookId' in fulfillment ? fulfillment.cookId
    : 'truckId' in fulfillment ? fulfillment.truckId
    : 'companyId' in fulfillment ? fulfillment.companyId
    : 'placeId' in fulfillment ? fulfillment.placeId
    : undefined;
  return raw && OFFERING_OWNER.test(raw) ? raw : undefined;
}

export function useShopCardPayment() {
  const stripe = useStripe();
  const utils = trpc.useUtils();
  const createCheckout = trpc.payments.createShopCheckout.useMutation();
  const confirmPayment = trpc.payments.confirmShopPayment.useMutation();
  const [charging, setCharging] = useState(false);

  const chargeShop = useCallback(async (shop: ShopName, lines: ShopLine[], fulfillment: ShopFulfillment, sellerAccountId?: string) => {
    if (fulfillment.shop !== shop) {
      throw new Error('This handoff does not match the shop.');
    }
    if (Platform.OS === 'web') {
      throw new Error('Payment is only available on the mobile app.');
    }
    setCharging(true);
    try {
      const explicitSeller = sellerAccountId && OFFERING_OWNER.test(sellerAccountId) ? sellerAccountId : undefined;
      const sellerId = explicitSeller ?? offeringOwnerId(fulfillment);
      const created = await createCheckout.mutateAsync({
        shop,
        lines,
        ...(sellerId ? { sellerId } : {}),
        deliver: fulfillmentIsDelivery(fulfillment),
      });
      const initPaymentSheet = stripe?.initPaymentSheet;
      const presentPaymentSheet = stripe?.presentPaymentSheet;
      if (!initPaymentSheet || !presentPaymentSheet || !created.clientSecret) {
        throw new Error('Payment system not available');
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: created.clientSecret,
        merchantDisplayName: 'HomeCookedPlate',
        returnURL: 'homecookedplate://checkout',
      });
      if (initError) throw new Error(initError.message);
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return null;
        throw new Error(presentError.message);
      }
      const paid = await confirmPayment.mutateAsync({
        paymentIntentId: created.paymentIntentId,
        fulfillment,
      });
      await utils.payments.listShopOrders.invalidate({ shop });
      return paid;
    } finally {
      setCharging(false);
    }
  }, [confirmPayment, createCheckout, stripe, utils]);

  return { chargeShop, charging };
}
