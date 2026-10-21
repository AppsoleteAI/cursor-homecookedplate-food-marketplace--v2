import { cookTimeZoneFromTags, pickupFitsWindow, pickupWindowNeedsCookZone, portionsFromTags } from '@/lib/meal-publish';
import { isSampleMealId } from '@/lib/sample-meals';

/** The plate checkout stops. Combined checkout uses the same stops before a home plate is charged. */
export function plateCheckoutBlock(input: {
  mealId: string;
  isSample?: boolean;
  tags?: string[] | null;
  quantity: number;
  pickupTime?: Date | null;
}): { title: string; message: string } | null {
  if (input.isSample || isSampleMealId(input.mealId)) {
    return { title: 'Sample plate', message: 'Sample plates are not for sale.' };
  }
  if (!input.pickupTime || input.pickupTime.getTime() < Date.now()) {
    return { title: 'Pickup time', message: 'Choose a pickup time that has not passed.' };
  }
  if (pickupWindowNeedsCookZone(input.tags)) {
    return { title: 'Pickup time', message: 'This plate has no cook time zone yet.' };
  }
  if (!pickupFitsWindow(input.tags, input.pickupTime, cookTimeZoneFromTags(input.tags))) {
    return { title: 'Pickup time', message: 'Choose a pickup time on a day and hour this plate is offered.' };
  }
  if (input.quantity > portionsFromTags(input.tags)) {
    return { title: 'Portions', message: 'This plate does not have that many portions.' };
  }
  return null;
}
