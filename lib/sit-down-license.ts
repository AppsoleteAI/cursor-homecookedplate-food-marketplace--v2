import { stateName } from '@/lib/cottage-food';

export const SIT_DOWN_RULE =
  'SitDownDelicious is for fully licensed, independently owned restaurants and small food shops: coffee, yogurt, ice cream, diners, and similar sit-down or takeout businesses. Franchises and corporate chains are not listed. Cottage food law does not cover this kitchen, and a food-truck permit does not either. The health permit belongs to the street address. This app does not inspect the restaurant, issue the license, or look up the fee.';

export type DiningService = 'sit_down' | 'takeout';

export const SERVICE_LABEL: Record<DiningService, string> = {
  sit_down: 'Sit down',
  takeout: 'Takeout',
};

export type SitDownLicense = {
  placeName: string;
  street: string;
  city: string;
  county: string;
  stateCode: string;
  healthDepartment: string;
  permitNumber: string;
  permitFee: string;
  inspectionNote: string;
  statuteNote: string;
  offersSitDown: boolean;
  offersTakeout: boolean;
  independentOwned: boolean;
  notFranchise: boolean;
  notChain: boolean;
  fixedLicensedKitchen: boolean;
  cottageDoesNotApply: boolean;
  regulationsConfirmed: boolean;
  updatedAt: string;
};

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|cocktail|alcohol|bar menu)\b/i;
const CHAIN = /\b(starbucks|mcdonald'?s?|dunkin|subway|chipotle|wendy'?s?|burger king|taco bell|kfc|pizza hut|domino'?s?|dairy queen|baskin-?robbins|cold stone|yogurtland|panera|chick-fil-a)\b/i;
const FRANCHISE_WORDS = /\b(franchise|franchised|corporate chain|chain location|publicly traded)\b/i;

export function evaluateSitDownLicense(record: SitDownLicense | null): { ok: boolean; blocks: string[] } {
  if (!record) {
    return { ok: false, blocks: ['Save the retail food license, the address, and the fee before listing a menu item.'] };
  }

  const blocks: string[] = [];
  const blob = `${record.placeName} ${record.statuteNote} ${record.street}`;
  if (record.placeName.trim().length < 2) blocks.push('Name the restaurant or shop.');
  if (CHAIN.test(blob) || FRANCHISE_WORDS.test(blob)) {
    blocks.push('Franchises and corporate chains are not listed on SitDownDelicious.');
  }
  if (record.street.trim().length < 6) blocks.push('Enter the street address of the licensed kitchen.');
  if (!record.stateCode) blocks.push('Choose the state of that address.');
  if (record.city.trim().length < 2) blocks.push('Enter the city.');
  if (record.county.trim().length < 2) blocks.push('Enter the county. A city health department can license this address on its own.');
  if (record.healthDepartment.trim().length < 2) blocks.push('Name the health department that licensed this address.');
  if (record.permitNumber.trim().length < 2) blocks.push('Record the retail food permit number.');
  if (record.permitFee.trim().length < 1) blocks.push('Record the permit fee from the agency. Use 0 only if they confirmed there is no fee.');
  if (record.inspectionNote.trim().length < 8) blocks.push('Record the last inspection result, or that the license is still in process.');
  if (record.statuteNote.trim().length < 12) blocks.push('Write what the health department requires for this sit-down or takeout kitchen.');
  if (!record.offersSitDown && !record.offersTakeout) blocks.push('Offer sit-down, takeout, or both.');
  if (!record.independentOwned) blocks.push('Confirm that this business is independently owned.');
  if (!record.notFranchise) blocks.push('Confirm that this location is not a franchise.');
  if (!record.notChain) blocks.push('Confirm that this business is not a corporate chain.');
  if (!record.fixedLicensedKitchen) blocks.push('Confirm that the food is prepared in the licensed kitchen at this street address.');
  if (!record.cottageDoesNotApply) blocks.push('Confirm that cottage food law is not the license for this restaurant.');
  if (!record.regulationsConfirmed) blocks.push('Confirm that you read the current retail-food rule for this address. The app has not verified it.');
  if (ALCOHOL.test(blob)) blocks.push('Alcohol cannot be sold on HomeCookedPlate.');
  if (record.stateCode && !stateName(record.stateCode)) blocks.push('Choose a state.');

  return { ok: blocks.length === 0, blocks };
}

export function evaluateSitDownItem(
  license: SitDownLicense | null,
  item: { name: string; price: number; summary: string; ingredients: string; allergens: string },
): { ok: boolean; blocks: string[] } {
  const licenseCheck = evaluateSitDownLicense(license);
  const blocks = [...licenseCheck.blocks];
  if (item.name.trim().length < 2) blocks.push('Name the menu item.');
  if (!Number.isFinite(item.price) || item.price <= 0) blocks.push('Enter a price greater than zero.');
  if (item.summary.trim().length < 8) blocks.push('Describe the item.');
  if (item.ingredients.trim().length < 2) blocks.push('List the ingredients.');
  if (item.allergens.trim().length < 2) blocks.push('Declare major allergens, or write “none of the major allergens.”');
  if (ALCOHOL.test(`${item.name} ${item.ingredients} ${item.summary}`)) {
    blocks.push('Alcohol cannot be listed on a SitDownDelicious menu.');
  }
  if (CHAIN.test(item.name) || FRANCHISE_WORDS.test(item.name)) {
    blocks.push('Franchises and corporate chains are not listed on SitDownDelicious.');
  }
  return { ok: blocks.length === 0, blocks };
}
