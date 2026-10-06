import { COMMISSARY_REQUIRED_STATES } from '@/lib/kitchen-rules';
import { stateName } from '@/lib/cottage-food';

export const FOOD_TRUCK_RULE =
  'FoodTruckPopup is for licensed mobile food units. Customers order ahead and pick up at the service window. Cottage food laws do not cover a food truck. A hot menu needs the health permit for the city or county where the window is open, and in most states a commissary agreement before that permit is issued. This app does not inspect the truck, issue the permit, or look up the fee.';

export const PICKUP_SLOTS = ['Next 15 minutes', 'In 30 minutes', 'In 45 minutes'] as const;
export type PickupSlot = (typeof PICKUP_SLOTS)[number];

export type TruckPermitRecord = {
  truckName: string;
  stateCode: string;
  city: string;
  county: string;
  healthDepartment: string;
  permitNumber: string;
  permitFee: string;
  commissaryNote: string;
  serviceArea: string;
  statuteNote: string;
  fireNote: string;
  handlerCard: string;
  regulationsConfirmed: boolean;
  cottageDoesNotApply: boolean;
  windowOnly: boolean;
  updatedAt: string;
};

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|rum|cocktail|alcohol)\b/i;
const WAIVED = /waived|no commissary|self-contained/i;

export function commissaryExpected(stateCode: string): boolean {
  return COMMISSARY_REQUIRED_STATES.includes(stateName(stateCode));
}

export function evaluateTruckPermit(record: TruckPermitRecord | null): { ok: boolean; blocks: string[] } {
  if (!record) {
    return { ok: false, blocks: ['Save the mobile food permit, commissary answer, and fee before listing a menu item.'] };
  }

  const blocks: string[] = [];
  if (record.truckName.trim().length < 2) blocks.push('Name the truck.');
  if (!record.stateCode) blocks.push('Choose the state where the window is open.');
  if (record.city.trim().length < 2) blocks.push('Enter the city where this permit lets you vend.');
  if (record.county.trim().length < 2) blocks.push('Enter the county. A city health department can be stricter than the state.');
  if (record.healthDepartment.trim().length < 2) blocks.push('Name the health department that issued, or must issue, the mobile unit permit.');
  if (record.permitNumber.trim().length < 2) blocks.push('Record the permit number, or the agency statement that the application is still open.');
  if (record.permitFee.trim().length < 1) blocks.push('Record the permit fee from the agency. Use 0 only if they confirmed there is no fee.');
  if (record.commissaryNote.trim().length < 8) {
    blocks.push('Name the licensed commissary, or write the agency’s answer if they said a separate kitchen is not required.');
  }
  if (commissaryExpected(record.stateCode) && WAIVED.test(record.commissaryNote)) {
    blocks.push('Published summaries expect a commissary agreement in this state before a mobile food license. Record the licensed kitchen. Do not mark it waived unless the health department has told you otherwise in writing, and then quote that writing in the rule note without using the word waived.');
  }
  if (record.stateCode === 'OH' && WAIVED.test(record.commissaryNote) && !/self-contained/i.test(`${record.statuteNote} ${record.commissaryNote}`)) {
    blocks.push('Ohio summaries describe skipping a separate commissary only when the state has approved a fully self-contained unit. Write that approval.');
  }
  if (record.serviceArea.trim().length < 8) blocks.push('Write the cities or lots this permit actually covers. A permit in one county does not travel.');
  if (record.statuteNote.trim().length < 12) blocks.push('Write what the health department said about vending from this truck.');
  if (record.fireNote.trim().length < 8) blocks.push('Record the fire-marshal result for propane and grease, or that the agency said it does not apply.');
  if (record.handlerCard.trim().length < 4) blocks.push('Record the food-handler or food-manager card, or the agency statement that none is required.');
  if (!record.regulationsConfirmed) blocks.push('Confirm that you read the current mobile-unit rule. The app has not verified it.');
  if (!record.cottageDoesNotApply) blocks.push('Confirm that cottage food law is not the license for this truck.');
  if (!record.windowOnly) blocks.push('FoodTruckPopup orders are picked up at the service window.');
  if (ALCOHOL.test(`${record.truckName} ${record.statuteNote}`)) {
    blocks.push('Alcohol cannot be sold on HomeCookedPlate.');
  }

  return { ok: blocks.length === 0, blocks };
}

export function evaluateTruckMenuItem(
  permit: TruckPermitRecord | null,
  item: { name: string; price: number; summary: string; ingredients: string; allergens: string },
): { ok: boolean; blocks: string[] } {
  const permitCheck = evaluateTruckPermit(permit);
  const blocks = [...permitCheck.blocks];
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
