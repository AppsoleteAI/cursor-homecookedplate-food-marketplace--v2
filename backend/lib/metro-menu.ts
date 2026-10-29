import { hasMapPin, withinPickupRadius, type MapPin } from './pickup-radius';

/** A named metro only shows plates from cooks saved in that metro. Remote shows cooks outside every metro. No saved metro shows none. */
export function mealVisibleInMetro(cookMetro: string | null | undefined, requested: string | undefined): boolean {
  const area = requested?.trim();
  if (!area) return false;
  if (area === 'Remote/Other') {
    return cookMetro == null || cookMetro === '' || cookMetro === 'Remote/Other';
  }
  return cookMetro === area;
}

/** Paying for a plate needs a saved metro, and that metro has to include the cook. */
export function buyerMetroCanOrder(cookMetro: string | null | undefined, buyerMetro: string | null | undefined): boolean {
  const area = buyerMetro?.trim();
  if (!area) return false;
  return mealVisibleInMetro(cookMetro, area);
}

/** Once kitchen pins exist, a plate is visible inside 20 miles. Until that SQL is applied, the metro name still decides. */
export function cookReachesBuyer(input: {
  pinsReady: boolean;
  cookPin: MapPin | null | undefined;
  buyerPin: MapPin | null | undefined;
  cookMetro: string | null | undefined;
  buyerMetro: string | null | undefined;
}): boolean {
  if (!input.pinsReady) return mealVisibleInMetro(input.cookMetro, input.buyerMetro?.trim() || undefined);
  if (!hasMapPin(input.buyerPin) || !hasMapPin(input.cookPin)) return false;
  return withinPickupRadius(input.cookPin, input.buyerPin);
}
