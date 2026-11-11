import { useMemo } from 'react';
import { chargedPlateBase } from '@/backend/lib/fees';
import type { OfferArea } from '@/backend/lib/gift-areas';
import { getPackage } from '@/constants/cater-event-deliver';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem } from '@/constants/food-truck-popup';
import { getPrepItem } from '@/constants/meal-prep-go';
import { getSitItem } from '@/constants/sit-down-delicious';
import { trpc } from '@/lib/trpc';

type PricedLine = { id: string; unitPrice: number; quantity: number };

export function useAreaOfferTotal(area: OfferArea, lines: PricedLine[]) {
  const listingKey = lines.map((line) => line.id).join('|');
  const listingIds = useMemo(() => [...new Set(listingKey.split('|').filter(Boolean))], [listingKey]);
  const offers = trpc.areaOffers.forListings.useQuery(
    { area, listingIds },
    { enabled: listingIds.length > 0, retry: false },
  );
  const lineTotal = (id: string, unitPrice: number, quantity: number) => {
    const qty = Math.max(1, Math.round(quantity));
    return chargedPlateBase(unitPrice, qty, offers.data?.[id] ?? null);
  };
  const baseAmount = lines.reduce((sum, line) => sum + lineTotal(line.id, line.unitPrice, line.quantity), 0);
  return { baseAmount, lineTotal, loading: listingIds.length > 0 && offers.isLoading };
}

/** Catalog sale totals for a combined checkout. A food cart uses the truck offer. A ghost kitchen uses the sit-down offer. */
export function useShopSalePrices(input: {
  farm: { productId: string; quantity: number }[];
  prep: { itemId: string; quantity: number }[];
  truck: { itemId: string; quantity: number }[];
  cater: { packageId: string; headcount: number }[];
  sit: { itemId: string; quantity: number }[];
}) {
  const farmLines = useMemo(() => input.farm.flatMap((item) => {
    const product = getCatalogProduct(item.productId);
    return product ? [{ id: item.productId, unitPrice: product.price, quantity: item.quantity }] : [];
  }), [input.farm]);
  const prepLines = useMemo(() => input.prep.flatMap((item) => {
    const product = getPrepItem(item.itemId);
    return product ? [{ id: item.itemId, unitPrice: product.price, quantity: item.quantity }] : [];
  }), [input.prep]);
  const truckLines = useMemo(() => input.truck.flatMap((item) => {
    const product = getMenuItem(item.itemId);
    return product ? [{ id: item.itemId, unitPrice: product.price, quantity: item.quantity }] : [];
  }), [input.truck]);
  const caterLines = useMemo(() => input.cater.flatMap((item) => {
    const product = getPackage(item.packageId);
    return product ? [{ id: item.packageId, unitPrice: product.pricePerPerson, quantity: item.headcount }] : [];
  }), [input.cater]);
  const sitLines = useMemo(() => input.sit.flatMap((item) => {
    const product = getSitItem(item.itemId);
    return product ? [{ id: item.itemId, unitPrice: product.price, quantity: item.quantity }] : [];
  }), [input.sit]);
  const farm = useAreaOfferTotal('farm', farmLines);
  const prep = useAreaOfferTotal('meal_prep', prepLines);
  const truck = useAreaOfferTotal('food_truck', truckLines);
  const cater = useAreaOfferTotal('catering', caterLines);
  const sit = useAreaOfferTotal('sit_down', sitLines);
  const lineTotal = (area: string, id: string, unitPrice: number, quantity: number) => {
    const shop = area === 'food_cart' ? truck : area === 'ghost_kitchen' ? sit : area === 'farm' ? farm : area === 'meal_prep' ? prep : area === 'food_truck' ? truck : area === 'catering' ? cater : area === 'sit_down' ? sit : null;
    if (!shop) return chargedPlateBase(unitPrice, Math.max(1, Math.round(quantity)), null);
    return shop.lineTotal(id, unitPrice, quantity);
  };
  return { lineTotal };
}
