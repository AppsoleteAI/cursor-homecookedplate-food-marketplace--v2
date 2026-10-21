import { forgetPaidCaterItems } from '@/hooks/cater-event-store';
import { forgetPaidFarmItems } from '@/hooks/farm-basket-store';
import { forgetPaidTruckItems } from '@/hooks/food-truck-store';
import { forgetPaidPrepItems } from '@/hooks/meal-prep-store';
import { forgetPaidSitItems } from '@/hooks/sit-down-store';
import { laneBasketsToClear } from '@/lib/paid-lane-baskets';

/** Empty the lane baskets on a paid charge, including a browser return that reloads the page. */
export async function clearPaidLaneBaskets(areas: readonly string[]) {
  const which = laneBasketsToClear(areas);
  await Promise.all([
    which.farm ? forgetPaidFarmItems() : Promise.resolve(),
    which.mealPrep ? forgetPaidPrepItems() : Promise.resolve(),
    which.truck ? forgetPaidTruckItems() : Promise.resolve(),
    which.catering ? forgetPaidCaterItems() : Promise.resolve(),
    which.sit ? forgetPaidSitItems() : Promise.resolve(),
  ]);
}
