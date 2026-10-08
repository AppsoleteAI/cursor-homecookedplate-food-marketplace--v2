import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useStripe } from '@/lib/stripe';
import type { ShopName } from '@/backend/lib/shop-catalog';

type ShopLine = { productId: string; quantity: number };

export function useShopCardPayment() {
  const stripe = useStripe();
  const createCheckout = trpc.payments.createShopCheckout.useMutation();
  const confirmPayment = trpc.payments.confirmShopPayment.useMutation();
  const [charging, setCharging] = useState(false);

  const chargeShop = useCallback(async (shop: ShopName, lines: ShopLine[]) => {
    if (Platform.OS === 'web') {
      throw new Error('Payment is only available on the mobile app.');
    }
    setCharging(true);
    try {
      const created = await createCheckout.mutateAsync({ shop, lines });
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
      return await confirmPayment.mutateAsync({ paymentIntentId: created.paymentIntentId });
    } finally {
      setCharging(false);
    }
  }, [confirmPayment, createCheckout, stripe]);

  return { chargeShop, charging };
}
