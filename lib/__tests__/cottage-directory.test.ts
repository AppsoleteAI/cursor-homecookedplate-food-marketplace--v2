import { frameworkForState, US_STATE_NAMES } from '../cottage-food';
import { COTTAGE_RESOURCES, COTTAGE_STATE_DIRECTORY, VEGETABLE_LEATHER_ALSO, VEGETABLE_LEATHER_PARAGRAPHS, VEGETABLE_LEATHER_TITLE, cottageBandLabel, cottageDirectoryRow, foodFreedomDirectory, isVegetableLeatherSearch } from '../cottage-directory';

describe('cottage food directory', () => {
  it('lists every state and the District of Columbia once', () => {
    const codes = COTTAGE_STATE_DIRECTORY.map((row) => row.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(US_STATE_NAMES.map((state) => state.code)));
    expect(codes).toContain('DC');
  });

  it('keeps the map bands and the states with no cottage law', () => {
    expect(cottageDirectoryRow('SD')?.band).toBe('baked_only');
    expect(cottageDirectoryRow('NH')?.band).toBe('baked_only');
    expect(cottageDirectoryRow('VT')?.band).toBe('baked_only');
    expect(cottageDirectoryRow('SC')?.band).toBe('baked_only');
    expect(cottageDirectoryRow('TX')?.band).toBe('hazardous');
    expect(cottageDirectoryRow('CA')?.band).toBe('non_hazardous');
    expect(cottageDirectoryRow('HI')?.band).toBe('none');
    expect(cottageDirectoryRow('NJ')?.band).toBe('none');
    expect(cottageBandLabel('baked_only')).toBe('Baked and confectionery goods only');
  });

  it('points at the map and does not invent a license number', () => {
    expect(COTTAGE_RESOURCES[0]?.url).toBe('https://www.farmtoconsumer.org/cottage-foods-map/');
    const blobs = COTTAGE_STATE_DIRECTORY.map((row) => `${row.note ?? ''} ${row.expanded ?? ''} ${row.cap ?? ''}`);
    expect(blobs.some((blob) => blob.match(/\b\d{5,}\b/))).toBe(false);
  });

  it('lists food-freedom states and only the caps the summaries named', () => {
    expect(foodFreedomDirectory().map((row) => row.code).sort()).toEqual(['MT', 'ND', 'OK', 'TN', 'UT', 'WY']);
    for (const code of ['MT', 'ND', 'OK', 'TN', 'UT', 'WY']) {
      expect(frameworkForState(code)).toBe('food_freedom');
      expect(cottageDirectoryRow(code)?.cap).toMatch(/No annual earnings cap is named/);
    }
    expect(frameworkForState('CO')).toBe('confirm_locally');
    expect(cottageDirectoryRow('CT')?.cap).toBe('$50,000 annual sales cap.');
    expect(cottageDirectoryRow('MS')?.cap).toBe('$35,000 annual cap on gross sales.');
    expect(cottageDirectoryRow('MD')?.cap).toBe('$50,000 sales cap before a commercial facility is described.');
    expect(cottageDirectoryRow('VT')?.cap).toBe('$30,000 annual revenue limit.');
    expect(cottageDirectoryRow('DC')?.cap).toBe('$25,000 annual sales limit.');
    expect(cottageDirectoryRow('VA')?.cap).toBe('$9,000 cap on that acidified-vegetable path.');
    expect(cottageDirectoryRow('WI')?.cap).toMatch(/\$5,000/);
    expect(cottageDirectoryRow('WA')?.cap).toMatch(/not named/);
    expect(cottageDirectoryRow('LA')?.expanded).toMatch(/cream-filled/);
    expect(cottageDirectoryRow('CA')?.cap).toBeUndefined();
  });

  it('defines vegetable leathers under both names', () => {
    expect(VEGETABLE_LEATHER_TITLE).toBe('Vegetable leathers');
    expect(VEGETABLE_LEATHER_ALSO).toBe('Fruit / Veggie Strips');
    expect(VEGETABLE_LEATHER_PARAGRAPHS.join(' ')).toMatch(/shelf-stable/);
    expect(VEGETABLE_LEATHER_PARAGRAPHS.join(' ')).toMatch(/Delaware/);
    expect(cottageDirectoryRow('DE')?.expanded).toMatch(/Fruit \/ Veggie Strips/);
    expect(isVegetableLeatherSearch('veggie strips')).toBe(true);
    expect(isVegetableLeatherSearch('lasagna')).toBe(false);
  });
});
