import { useEffect } from 'react';
import type { SavedShopOrder } from '@/backend/lib/shop-fulfillment';
import type { ShopName } from '@/backend/lib/shop-catalog';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';

export function useSavedShopOrders(shop: ShopName, apply: (orders: SavedShopOrder[]) => void) {
  const { isAuthenticated } = useAuth();
  const saved = trpc.payments.listShopOrders.useQuery({ shop }, { enabled: isAuthenticated });

  useEffect(() => {
    if (saved.data) apply(saved.data);
  }, [apply, saved.data]);
}
