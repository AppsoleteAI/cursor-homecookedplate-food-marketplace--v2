import { evaluateSectionAgreement, type SectionAgreement } from '@/lib/section-agreement';

export const CATER_EVENT_RULE =
  'CaterEventDeliver is for catering companies taking group orders. Packages are a fixed price per person, with a minimum of 6. The company drops off the food and sets it up. This app does not hire a driver or add a 15% to 25% marketplace commission. The service fee is 10%. A Premium PlateTaker pays 5% on an order of $20 or more. The food rules for that kitchen belong to the cook.';

export const CATER_AGREEMENT_BLOCK =
  'Save the catering agreement before a package goes on the menu.';

export const CATER_MINIMUM_HEADCOUNT = 6;

export const DROP_OFF_WINDOWS = [
  'Weekday lunch, 11:00–1:00',
  'Weekday lunch, 12:00–2:00',
  'Afternoon shift, 2:00–4:00',
  'Evening event, 5:00–7:00',
] as const;

export type DropOffWindow = (typeof DROP_OFF_WINDOWS)[number];

export type CaterLicenseRecord = SectionAgreement;

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|rum|cocktail|alcohol)\b/i;

export function evaluateCaterLicense(record: CaterLicenseRecord | null): { ok: boolean; blocks: string[] } {
  return evaluateSectionAgreement(record, CATER_AGREEMENT_BLOCK);
}

export function evaluateCaterPackage(
  license: CaterLicenseRecord | null,
  item: {
    name: string;
    pricePerPerson: number;
    minimumHeadcount: number;
    summary: string;
    ingredients: string;
    allergens: string;
  },
): { ok: boolean; blocks: string[] } {
  const blocks = [...evaluateCaterLicense(license).blocks];
  if (item.name.trim().length < 2) blocks.push('Name the package.');
  if (!Number.isFinite(item.pricePerPerson) || item.pricePerPerson <= 0) blocks.push('Enter a per-person price greater than zero.');
  if (!Number.isInteger(item.minimumHeadcount) || item.minimumHeadcount < CATER_MINIMUM_HEADCOUNT) {
    blocks.push(`Set a minimum headcount of at least ${CATER_MINIMUM_HEADCOUNT}. Single plates belong on the cooked-plate menu.`);
  }
  if (item.summary.trim().length < 8) blocks.push('Describe the package.');
  if (item.ingredients.trim().length < 2) blocks.push('List the ingredients.');
  if (item.allergens.trim().length < 2) blocks.push('Declare major allergens, or write “none of the major allergens.”');
  if (ALCOHOL.test(`${item.name} ${item.ingredients} ${item.summary}`)) {
    blocks.push('Alcohol cannot be listed on a CaterEventDeliver package.');
  }
  return { ok: blocks.length === 0, blocks };
}
