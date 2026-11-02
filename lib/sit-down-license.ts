import { evaluateSectionAgreement, type SectionAgreement } from '@/lib/section-agreement';

export const SIT_DOWN_RULE =
  'SitDownDelicious is for independently owned restaurants, small food shops, and independent ghost kitchens. Restaurants and shops can offer a table or takeout. A ghost kitchen is pickup or takeout with no dining room. Franchises and corporate chains are not listed. The food rules for that kitchen belong to the cook.';

export const SIT_AGREEMENT_BLOCK =
  'Save the restaurant agreement before a menu item goes on the menu.';

export type DiningService = 'sit_down' | 'takeout';

export const SERVICE_LABEL: Record<DiningService, string> = {
  sit_down: 'Sit down',
  takeout: 'Takeout',
};

export type SitDownLicense = SectionAgreement;

const ALCOHOL = /\b(wine|beer|liquor|whiskey|whisky|vodka|cocktail|alcohol|bar menu)\b/i;
const CHAIN = /\b(starbucks|mcdonald'?s?|dunkin|subway|chipotle|wendy'?s?|burger king|taco bell|kfc|pizza hut|domino'?s?|dairy queen|baskin-?robbins|cold stone|yogurtland|panera|chick-fil-a)\b/i;
const FRANCHISE_WORDS = /\b(franchise|franchised|corporate chain|chain location|publicly traded)\b/i;

export function evaluateSitDownLicense(record: SitDownLicense | null): { ok: boolean; blocks: string[] } {
  return evaluateSectionAgreement(record, SIT_AGREEMENT_BLOCK);
}

export function evaluateSitDownItem(
  license: SitDownLicense | null,
  item: { name: string; price: number; summary: string; ingredients: string; allergens: string },
): { ok: boolean; blocks: string[] } {
  const blocks = [...evaluateSitDownLicense(license).blocks];
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
