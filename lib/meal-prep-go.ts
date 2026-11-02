import type { PrepDiet, PrepLane } from '@/constants/meal-prep-go';
import { evaluateSectionAgreement, type SectionAgreement } from '@/lib/section-agreement';

export const MEAL_PREP_RULE =
  'MealPrepGo is a weekly plan from one local cook. Ready meals are finished and reheated. Cook kits are portioned ingredients with a recipe. Add-ons ride with that week. This app does not book a driver. The service fee is 10%. A Premium PlateTaker pays 5% on an order of $20 or more. The food rules for that kitchen belong to the cook.';

export const PREP_AGREEMENT_BLOCK =
  'Save the weekly-kitchen agreement before a weekly item goes on the menu.';

export const PREP_LANES: PrepLane[] = ['ready', 'cook', 'addon'];

export const PREP_DIETS: PrepDiet[] = ['balanced', 'high_protein', 'plant', 'classic'];

export const WEEK_SIZES = [6, 8, 10, 12] as const;

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|rum|cocktail|alcohol)\b/i;

export function laneLabel(lane: PrepLane): string {
  switch (lane) {
    case 'ready':
      return 'Ready';
    case 'cook':
      return 'Cook';
    case 'addon':
      return 'Add-on';
  }
}

export function laneDetail(lane: PrepLane): string {
  switch (lane) {
    case 'ready':
      return 'Heat and eat. About 15 minutes.';
    case 'cook':
      return 'Portioned ingredients and a recipe. About 30 to 40 minutes.';
    case 'addon':
      return 'Rides with the week. Not a meal.';
  }
}

export function dietLabel(diet: PrepDiet): string {
  switch (diet) {
    case 'balanced':
      return 'Balanced';
    case 'high_protein':
      return 'High protein';
    case 'plant':
      return 'Plant-based';
    case 'classic':
      return 'Classic';
  }
}

export function weekMix(readyCount: number, cookCount: number): string {
  const meals = readyCount + cookCount;
  if (meals === 0) return 'No meals yet';
  if (cookCount === 0) return 'Mostly ready';
  if (readyCount === 0) return 'Mostly cook';
  const readyShare = readyCount / meals;
  if (readyShare >= 0.7) return 'Mostly ready';
  if (readyShare <= 0.3) return 'Mostly cook';
  return 'Half and half';
}

export type PrepKitchenRecord = SectionAgreement;

export function evaluatePrepKitchen(record: PrepKitchenRecord | null): { ok: boolean; blocks: string[] } {
  return evaluateSectionAgreement(record, PREP_AGREEMENT_BLOCK);
}

export function evaluatePrepItem(
  kitchen: PrepKitchenRecord | null,
  item: {
    name: string;
    price: number;
    minutes: number;
    lane: PrepLane;
    summary: string;
    ingredients: string;
    allergens: string;
    recipeNote: string;
  },
): { ok: boolean; blocks: string[] } {
  const kitchenCheck = evaluatePrepKitchen(kitchen);
  const blocks = [...kitchenCheck.blocks];
  if (item.name.trim().length < 2) blocks.push('Name the item.');
  if (!Number.isFinite(item.price) || item.price <= 0) blocks.push('Enter a price greater than zero.');
  if (item.summary.trim().length < 8) blocks.push('Describe what the buyer receives.');
  if (item.ingredients.trim().length < 4) blocks.push('List the ingredients.');
  if (item.allergens.trim().length < 2) blocks.push('List allergens, or write None.');
  if (item.lane === 'addon') {
    if (item.minutes !== 0) blocks.push('An add-on is not cooked by the buyer. Set minutes to 0.');
  } else if (!Number.isInteger(item.minutes) || item.minutes < 10 || item.minutes > 90) {
    blocks.push('Enter prep or reheat minutes between 10 and 90.');
  }
  if (item.lane === 'cook' && item.recipeNote.trim().length < 8) {
    blocks.push('A cook kit needs the recipe steps.');
  }
  if (item.lane === 'ready' && item.recipeNote.trim().length > 0) {
    blocks.push('A ready meal is already finished. Leave the recipe blank.');
  }
  if (ALCOHOL.test(`${item.name} ${item.summary} ${item.ingredients}`)) {
    blocks.push('Alcohol cannot be sold on HomeCookedPlate.');
  }
  return { ok: blocks.length === 0, blocks };
}
