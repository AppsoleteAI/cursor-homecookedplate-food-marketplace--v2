import { highlightBakedCottage, isCottageSearch, isWidelyPermittedCottageFood } from '../baked-cottage';

describe('highlighted cottage foods', () => {
  it('highlights the shelf-stable foods cottage laws commonly allow', () => {
    expect(highlightBakedCottage({
      name: 'Country sourdough',
      summary: 'Shelf-stable loaf',
      ingredients: 'Wheat flour, water, salt',
      track: 'cottage_non_tcs',
      stateCode: 'CA',
    })).toBe(true);
    expect(highlightBakedCottage({
      name: 'Apple butter',
      summary: 'Shelf-stable apple butter',
      track: 'cottage_non_tcs',
      stateCode: 'PA',
    })).toBe(true);
    expect(highlightBakedCottage({
      name: 'Raw honey',
      track: 'cottage_non_tcs',
      stateCode: 'UT',
    })).toBe(true);
    expect(highlightBakedCottage({
      name: 'Orange marmalade',
      track: 'cottage_non_tcs',
      stateCode: 'FL',
    })).toBe(true);
    expect(highlightBakedCottage({
      name: 'Oat granola',
      track: 'cottage_non_tcs',
      stateCode: 'ND',
    })).toBe(true);
    expect(highlightBakedCottage({
      name: 'Country sourdough',
      track: 'cottage_non_tcs',
      stateCode: 'NY',
    })).toBe(true);
  });

  it('leaves refrigerated foods and other tracks off the shelf', () => {
    expect(highlightBakedCottage({
      name: 'Cream pie',
      track: 'cottage_non_tcs',
      stateCode: 'CA',
    })).toBe(false);
    expect(highlightBakedCottage({
      name: 'Cheesecake',
      track: 'cottage_non_tcs',
      stateCode: 'WY',
    })).toBe(false);
    expect(highlightBakedCottage({
      name: 'Country sourdough',
      track: 'whole_produce',
      stateCode: 'CA',
    })).toBe(false);
    expect(highlightBakedCottage({
      name: 'Pasture eggs',
      track: 'shell_eggs',
      stateCode: 'WY',
    })).toBe(false);
    expect(isWidelyPermittedCottageFood('cheesecake')).toBe(false);
  });

  it('notices a Home search for cottage foods', () => {
    expect(isCottageSearch('sourdough')).toBe(true);
    expect(isCottageSearch('cottage')).toBe(true);
    expect(isCottageSearch('orange marmalade')).toBe(true);
    expect(isCottageSearch('popcorn')).toBe(true);
    expect(isCottageSearch('fruit leather')).toBe(true);
    expect(isCottageSearch('veggie strips')).toBe(true);
    expect(isCottageSearch('lasagna')).toBe(false);
    expect(isCottageSearch('pi')).toBe(false);
  });
});
