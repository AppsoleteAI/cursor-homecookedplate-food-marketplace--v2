/**
 * Early Bird PlateMaker slots. One slot per 10,000 people, then clamped.
 * Populations are U.S. Census Bureau Vintage 2024 metropolitan estimates for July 1, 2024.
 */

export const EARLY_BIRD_PEOPLE_PER_PLATEMAKER = 10_000;
export const EARLY_BIRD_MIN_PLATEMAKERS = 200;
export const EARLY_BIRD_MAX_PLATEMAKERS = 1_000;

export const METRO_POPULATION_2024: Record<string, number> = {
  'New York-Newark-Jersey City': 19_940_274,
  'Los Angeles-Long Beach-Anaheim': 12_927_614,
  'Chicago-Naperville-Elgin': 9_408_576,
  'Dallas-Fort Worth-Arlington': 8_344_032,
  'Houston-The Woodlands-Sugar Land': 7_796_182,
  'Washington-Arlington-Alexandria': 6_436_489,
  'Philadelphia-Camden-Wilmington': 6_330_422,
  'Miami-Fort Lauderdale-Pompano Beach': 6_457_988,
  'Atlanta-Sandy Springs-Alpharetta': 6_411_149,
  'Boston-Cambridge-Newton': 5_025_517,
  'Phoenix-Mesa-Chandler': 5_186_958,
  'San Francisco-Oakland-Berkeley': 4_648_486,
  'Riverside-San Bernardino-Ontario': 4_744_214,
  'Detroit-Warren-Dearborn': 4_400_578,
  'Seattle-Tacoma-Bellevue': 4_145_494,
  'Minneapolis-St. Paul-Bloomington': 3_757_952,
  'San Diego-Chula Vista-Carlsbad': 3_298_799,
  'Tampa-St. Petersburg-Clearwater': 3_424_560,
  'Denver-Aurora-Lakewood': 3_052_498,
  'Baltimore-Columbia-Towson': 2_859_024,
  'St. Louis': 2_811_927,
  'Orlando-Kissimmee-Sanford': 2_940_513,
  'Charlotte-Concord-Gastonia': 2_883_370,
  'San Antonio-New Braunfels': 2_763_006,
  'Portland-Vancouver-Hillsboro': 2_537_904,
  'Sacramento-Roseville-Folsom': 2_463_127,
  'Pittsburgh': 2_429_917,
  'Austin-Round Rock-Georgetown': 2_550_637,
  'Las Vegas-Henderson-Paradise': 2_398_871,
  'Cincinnati': 2_302_815,
  'Kansas City': 2_253_579,
  'Columbus': 2_225_377,
  'Indianapolis-Carmel-Anderson': 2_174_833,
  'Cleveland-Elyria': 2_171_877,
  'Nashville-Davidson-Murfreesboro-Franklin': 2_150_553,
  'Virginia Beach-Norfolk-Newport News': 1_794_278,
  'Providence-Warwick': 1_700_901,
  'Jacksonville': 1_760_548,
  'Milwaukee-Waukesha': 1_574_452,
  'Oklahoma City': 1_497_821,
  'Raleigh-Cary': 1_562_009,
  'Memphis': 1_339_345,
  'Richmond': 1_370_165,
  'Louisville/Jefferson County': 1_394_234,
  'New Orleans-Metairie': 966_230,
  'Salt Lake City': 1_300_762,
  'Hartford-West Hartford-East Hartford': 1_169_048,
  'Buffalo-Cheektowaga': 1_160_172,
  'Birmingham-Hoover': 1_192_583,
  'Rochester': 1_057_218,
  'Anchorage': 407_213,
  'Honolulu': 998_747,
  'San Juan': 2_035_484,
  'Mayagüez': 207_205,
  // Vintage 2024 metro tables omit the U.S. Virgin Islands. This is the 2020 Census count. The slot stays at the 200 floor.
  'Charlotte Amalie': 87_146,
};

export function earlyBirdPlateMakerCap(population: number): number {
  const slots = Math.floor(population / EARLY_BIRD_PEOPLE_PER_PLATEMAKER);
  if (!Number.isFinite(slots)) return EARLY_BIRD_MIN_PLATEMAKERS;
  return Math.min(EARLY_BIRD_MAX_PLATEMAKERS, Math.max(EARLY_BIRD_MIN_PLATEMAKERS, slots));
}

export function earlyBirdCapForMetro(name: string | null | undefined): number {
  if (!name) return EARLY_BIRD_MIN_PLATEMAKERS;
  const population = METRO_POPULATION_2024[name];
  if (typeof population !== 'number') return EARLY_BIRD_MIN_PLATEMAKERS;
  return earlyBirdPlateMakerCap(population);
}
