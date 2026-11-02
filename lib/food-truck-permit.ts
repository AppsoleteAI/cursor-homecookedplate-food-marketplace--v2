import { evaluateSectionAgreement, type SectionAgreement } from '@/lib/section-agreement';

export const FOOD_TRUCK_RULE =
  'FoodTruckPopup is for independent food trucks and independent food carts. Customers order ahead and pick up at the window or the cart. A franchise cart is not listed. The food rules for that stop belong to the cook.';

export const TRUCK_AGREEMENT_BLOCK =
  'Save the truck agreement before a menu item goes on the menu.';

export const PICKUP_SLOTS = ['Next 15 minutes', 'In 30 minutes', 'In 45 minutes'] as const;
export type PickupSlot = (typeof PICKUP_SLOTS)[number];

export type TruckPermitRecord = SectionAgreement;

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|rum|cocktail|alcohol)\b/i;

export function evaluateTruckPermit(record: TruckPermitRecord | null): { ok: boolean; blocks: string[] } {
  return evaluateSectionAgreement(record, TRUCK_AGREEMENT_BLOCK);
}

export function evaluateTruckMenuItem(
  permit: TruckPermitRecord | null,
  item: { name: string; price: number; summary: string; ingredients: string; allergens: string },
): { ok: boolean; blocks: string[] } {
  const blocks = [...evaluateTruckPermit(permit).blocks];
  if (item.name.trim().length < 2) blocks.push('Name the menu item.');
  if (!Number.isFinite(item.price) || item.price <= 0) blocks.push('Enter a price greater than zero.');
  if (item.summary.trim().length < 8) blocks.push('Describe the item.');
  if (item.ingredients.trim().length < 2) blocks.push('List the ingredients.');
  if (item.allergens.trim().length < 2) blocks.push('Declare major allergens, or write “none of the major allergens.”');
  if (ALCOHOL.test(`${item.name} ${item.ingredients} ${item.summary}`)) {
    blocks.push('Alcohol cannot be listed on a FoodTruckPopup menu.');
  }
  return { ok: blocks.length === 0, blocks };
}
