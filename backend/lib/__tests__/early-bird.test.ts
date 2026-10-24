import { membershipPriceCents } from '../fees';
import { addDays, canClaimEarlyBird } from '../early-bird';
import {
  EARLY_BIRD_MAX_PLATEMAKERS,
  EARLY_BIRD_MIN_PLATEMAKERS,
  earlyBirdCapForMetro,
  earlyBirdPlateMakerCap,
  METRO_POPULATION_2024,
} from '../early-bird-cap';
import { METRO_CENTERS, METRO_RADIUS_METERS, nearestMetro } from '../metro-radius';

describe('Early Bird claim', () => {
  const open = {
    role: 'platemaker' as const,
    metroArea: 'Austin-Round Rock-Georgetown',
    paid: false,
    metroActive: true,
    rank: 4,
    maxCap: 100,
    trialEndsAt: null,
  };

  it('offers Early Bird to a PlateMaker inside the metro cap', () => {
    expect(canClaimEarlyBird(open)).toBe(true);
  });

  it('does not offer Early Bird to a PlateTaker', () => {
    expect(canClaimEarlyBird({ ...open, role: 'platetaker' })).toBe(false);
  });

  it('does not offer Early Bird outside an active metro or after the cap', () => {
    expect(canClaimEarlyBird({ ...open, metroArea: 'Remote/Other' })).toBe(false);
    expect(canClaimEarlyBird({ ...open, metroActive: false })).toBe(false);
    expect(canClaimEarlyBird({ ...open, rank: 101 })).toBe(false);
  });

  it('does not offer Early Bird twice or to a paid PlateMaker', () => {
    expect(canClaimEarlyBird({ ...open, trialEndsAt: '2026-12-01T00:00:00.000Z' })).toBe(false);
    expect(canClaimEarlyBird({ ...open, paid: true })).toBe(false);
  });

  it('logs a 90-day end from the start instant', () => {
    const started = new Date('2026-10-18T16:00:00.000Z');
    expect(addDays(started, 90).toISOString()).toBe('2027-01-16T16:00:00.000Z');
  });
});

describe('Early Bird slots', () => {
  it('gives one PlateMaker per 10,000 people, from 200 to 1,000', () => {
    expect(earlyBirdPlateMakerCap(19_940_274)).toBe(1_000);
    expect(earlyBirdPlateMakerCap(12_927_614)).toBe(1_000);
    expect(earlyBirdPlateMakerCap(9_408_576)).toBe(940);
    expect(earlyBirdPlateMakerCap(2_429_917)).toBe(242);
    expect(earlyBirdPlateMakerCap(966_230)).toBe(200);
    expect(earlyBirdCapForMetro('Pittsburgh')).toBe(242);
    expect(earlyBirdCapForMetro('New York-Newark-Jersey City')).toBe(EARLY_BIRD_MAX_PLATEMAKERS);
    expect(earlyBirdCapForMetro('New Orleans-Metairie')).toBe(EARLY_BIRD_MIN_PLATEMAKERS);
  });

  it('covers every saved metro and stays inside the bounds', () => {
    expect(Object.keys(METRO_POPULATION_2024)).toHaveLength(50);
    for (const metro of METRO_CENTERS) {
      const cap = earlyBirdCapForMetro(metro.name);
      expect(cap).toBeGreaterThanOrEqual(EARLY_BIRD_MIN_PLATEMAKERS);
      expect(cap).toBeLessThanOrEqual(EARLY_BIRD_MAX_PLATEMAKERS);
    }
  });

  it('offers Early Bird through the metro slot and stops on the next PlateMaker', () => {
    const pittsburgh = earlyBirdCapForMetro('Pittsburgh');
    const maker = {
      role: 'platemaker' as const,
      metroArea: 'Pittsburgh',
      paid: false,
      metroActive: true,
      rank: pittsburgh,
      maxCap: pittsburgh,
      trialEndsAt: null,
    };
    expect(canClaimEarlyBird(maker)).toBe(true);
    expect(canClaimEarlyBird({ ...maker, rank: pittsburgh + 1 })).toBe(false);
  });
});

describe('50-mile metro circles', () => {
  it('covers all 50 downtowns with one radius', () => {
    expect(METRO_CENTERS).toHaveLength(50);
    expect(METRO_RADIUS_METERS).toBe(80_000);
    expect(new Set(METRO_CENTERS.map((metro) => metro.name)).size).toBe(50);
  });

  it('matches a Pittsburgh point and a Philadelphia point to their own downtowns', () => {
    expect(nearestMetro(40.4803, -79.978)?.name).toBe('Pittsburgh');
    expect(nearestMetro(39.9526, -75.1652)?.name).toBe('Philadelphia-Camden-Wilmington');
  });

  it('picks the closer downtown when two 50-mile circles overlap', () => {
    expect(nearestMetro(38.8816, -77.091)?.name).toBe('Washington-Arlington-Alexandria');
    expect(nearestMetro(39.2904, -76.6122)?.name).toBe('Baltimore-Columbia-Towson');
  });

  it('leaves a point outside every circle unmatched', () => {
    expect(nearestMetro(0, 0)).toBeNull();
  });
});

describe('membership charge by role', () => {
  it('charges PlateMaker and PlateTaker their own monthly and yearly amounts', () => {
    expect(membershipPriceCents('platemaker', 'month')).toBe(499);
    expect(membershipPriceCents('platemaker', 'year')).toBe(3999);
    expect(membershipPriceCents('platetaker', 'month')).toBe(799);
    expect(membershipPriceCents('platetaker', 'year')).toBe(7599);
  });
});