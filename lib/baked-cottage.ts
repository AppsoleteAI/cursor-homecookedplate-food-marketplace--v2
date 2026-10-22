import type { RegulatoryTrack } from '@/lib/cottage-food';

const WIDELY_PERMITTED = /\b(bread|loaf|loaves|sourdough|cookie|cookies|granola|biscuit|biscuits|muffin|muffins|scone|scones|brownie|brownies|cake|cakes|pastry|pastries|pie|pies|bagel|bagels|cracker|crackers|shortbread|baklava|jam|jams|jelly|jellies|preserve|preserves|marmalade|fruit butter|apple butter|brittle|fudge|toffee|candy|candies|popcorn|kettle corn|coffee|tea|teas|honey|syrup|maple|vinegar|mustard|trail mix|pancake mix|waffle mix|spice|spices|seasoning|seasonings|dry rub|rubs|dried herbs)\b/i;
const NOT_SHELF_STABLE = /\b(cheesecake|cream|custard|meat|chicken|beef|pork|fish|seafood|milk|cheese)\b/i;

const COTTAGE_SEARCH = /\b(cottage|bread|loaf|loaves|sourdough|cookie|cookies|granola|baked|biscuit|biscuits|muffin|muffins|jam|jams|jelly|marmalade|honey|candy|fudge|toffee|popcorn|coffee|tea|vinegar|mustard|trail mix|vegetable leathers?|fruit leathers?|veggie strips|fruit strips)\b/i;

export function isWidelyPermittedCottageFood(text: string): boolean {
  return WIDELY_PERMITTED.test(text) && !NOT_SHELF_STABLE.test(text);
}

export function highlightBakedCottage(item: {
  name: string;
  summary?: string;
  ingredients?: string;
  track: RegulatoryTrack;
  stateCode: string;
}): boolean {
  if (item.track !== 'cottage_non_tcs') return false;
  const text = `${item.name} ${item.summary ?? ''} ${item.ingredients ?? ''}`;
  return isWidelyPermittedCottageFood(text);
}

export function isCottageSearch(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 3) return false;
  return COTTAGE_SEARCH.test(trimmed);
}

export const BAKED_COTTAGE_NOTE =
  'Cottage foods are listed in FarmGrownBasket, not with cooked plates. Shelf-stable foods that cottage laws commonly allow are highlighted there. Refrigerated foods are not on that shelf.';

export const BAKED_COTTAGE_LINK = '/farm-grown-basket/market?highlight=cottage';
