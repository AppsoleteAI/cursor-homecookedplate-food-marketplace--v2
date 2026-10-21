import { useMemo } from 'react';
import { quoteCard } from '@/backend/lib/combined-checkout';
import { useAuth } from '@/hooks/auth-context';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem } from '@/constants/food-truck-popup';
import { getPrepItem } from '@/constants/meal-prep-go';
import { getPackage } from '@/constants/cater-event-deliver';
import { getSitItem } from '@/constants/sit-down-delicious';
import { useCart } from '@/hooks/cart-context';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { useSitDown } from '@/hooks/sit-down-store';
import { gatherCombinedCheckouts } from '@/lib/gather-combined-checkouts';

function previewLine(area: string, productId: string, quantity: number) {
  if (area === 'home') return null;
  if (area === 'farm') {
    const product = getCatalogProduct(productId);
    return product ? { name: product.name, quantity, unitPrice: product.price } : null;
  }
  if (area === 'meal_prep') {
    const item = getPrepItem(productId);
    return item ? { name: item.name, quantity, unitPrice: item.price } : null;
  }
  if (area === 'food_truck' || area === 'food_cart') {
    const item = getMenuItem(productId);
    return item ? { name: item.name, quantity, unitPrice: item.price } : null;
  }
  if (area === 'catering') {
    const item = getPackage(productId);
    return item ? { name: item.name, quantity, unitPrice: item.pricePerPerson } : null;
  }
  const item = getSitItem(productId);
  return item ? { name: item.name, quantity, unitPrice: item.price } : null;
}

export function useCombinedBill() {
  const { user } = useAuth();
  const cart = useCart();
  const farm = useFarmBasket();
  const prep = useMealPrep();
  const truck = useFoodTruck();
  const cater = useCaterEvent();
  const sit = useSitDown();

  const gathered = useMemo(() => gatherCombinedCheckouts({
    home: cart.items,
    farm: farm.items,
    prep: prep.items,
    truck: truck.items,
    cater: cater.items,
    sit: sit.items,
  }), [cart.items, farm.items, prep.items, truck.items, cater.items, sit.items]);

  const preview = useMemo(() => quoteCard(gathered.checkouts.map((checkout) => ({
    area: checkout.area,
    sellerId: checkout.sellerId || checkout.area,
    sellerName: checkout.sellerName,
    buyerRole: user?.role,
    buyerMembershipTier: user?.membershipTier,
    lines: checkout.area === 'home'
      ? cart.items
        .filter((item) => item.meal.plateMakerId === checkout.sellerId)
        .map((item) => ({ name: item.meal.name, quantity: item.quantity, unitPrice: item.meal.price }))
      : checkout.lines.flatMap((line) => {
        const priced = previewLine(checkout.area, line.productId, line.quantity);
        return priced ? [priced] : [];
      }),
  }))), [gathered.checkouts, cart.items, user?.membershipTier, user?.role]);

  const openSections = [
    cart.items.length > 0,
    farm.items.length > 0,
    prep.items.length > 0,
    truck.items.length > 0,
    cater.items.length > 0,
    sit.items.length > 0,
  ].filter(Boolean).length;

  return { gathered, preview, payInMainCart: openSections >= 2 };
}
