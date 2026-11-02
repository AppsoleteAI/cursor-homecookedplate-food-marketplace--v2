import { evaluateCaterLicense, evaluateCaterPackage } from '../cater-event-license';
import { evaluateListing } from '../cottage-food';
import { evaluateTruckPermit } from '../food-truck-permit';
import { evaluateKitchenPermit } from '../kitchen-permit';
import { evaluatePrepKitchen } from '../meal-prep-go';
import { evaluateSitDownLicense } from '../sit-down-license';

const agreed = {
  readFoodInformation: true,
  readStateInformation: true,
  acceptsLocalRules: true,
  acceptsAllLiability: true,
  waivesPlatformLiability: true,
  maintainsCommissaryAccess: true,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('home kitchen agreement', () => {
  it('accepts the acknowledgements', () => {
    expect(evaluateKitchenPermit(agreed).ok).toBe(true);
  });

  it('refuses a missing agreement and an old permit record', () => {
    expect(evaluateKitchenPermit(null).ok).toBe(false);
    expect(evaluateKitchenPermit({
      kitchenName: 'Ada Kitchen',
      stateCode: 'UT',
      permitNumber: 'SL-10442',
      permitFee: '0',
      statuteNote: 'The agency charged no fee.',
      regulationsConfirmed: true,
      cottageDoesNotApply: true,
    }).ok).toBe(false);
  });

  it('uses the same acknowledgements for every section', () => {
    const checks = [
      evaluateListing(agreed),
      evaluateTruckPermit(agreed),
      evaluateSitDownLicense(agreed),
      evaluateCaterLicense(agreed),
      evaluatePrepKitchen(agreed),
    ];
    expect(checks.every((check) => check.ok)).toBe(true);
    const oldPermit = { permitNumber: 'SL-10442', permitFee: '0' } as never;
    expect([
      evaluateListing(oldPermit),
      evaluateTruckPermit(oldPermit),
      evaluateSitDownLicense(oldPermit),
      evaluateCaterLicense(oldPermit),
      evaluatePrepKitchen(oldPermit),
    ].every((check) => check.ok)).toBe(false);
  });

  it('lets a catering package start at 6 people', () => {
    const item = {
      name: 'Lunch trays',
      pricePerPerson: 12,
      minimumHeadcount: 6,
      summary: 'Trays for a weekday lunch drop-off.',
      ingredients: 'Rice, vegetables',
      allergens: 'None of the major allergens.',
    };
    expect(evaluateCaterPackage(agreed, item).ok).toBe(true);
    expect(evaluateCaterPackage(agreed, { ...item, minimumHeadcount: 5 }).ok).toBe(false);
  });

  it('refuses until every acknowledgement is on', () => {
    expect(evaluateKitchenPermit({ ...agreed, readFoodInformation: false }).ok).toBe(false);
    expect(evaluateKitchenPermit({ ...agreed, readStateInformation: false }).ok).toBe(false);
    expect(evaluateKitchenPermit({ ...agreed, acceptsLocalRules: false }).ok).toBe(false);
    expect(evaluateKitchenPermit({ ...agreed, acceptsAllLiability: false }).ok).toBe(false);
    expect(evaluateKitchenPermit({ ...agreed, waivesPlatformLiability: false }).ok).toBe(false);
    expect(evaluateKitchenPermit({ ...agreed, maintainsCommissaryAccess: false }).ok).toBe(false);
  });
});
