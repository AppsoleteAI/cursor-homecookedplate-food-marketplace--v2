export const SECTION_AGREEMENT_RULE =
  'Food rules depend on the city, county, and state. Some places require no license. Some require a limited license. Others require a stricter permit, and some require a commissary kitchen. HomeCookedPlate does not decide which rule applies and does not enforce that matrix. A listing stays off the menu until this account acknowledges the in-app food information, the in-app state information, the duty to follow the rules where the food is prepared, full responsibility and all liability for food served, the waiver of claims against HomeCookedPlate, Appsolete, PUSL, LLC, and associated entities and individuals, and commissary access when a governing body requires a commissary kitchen.';

export type SectionAgreement = {
  readFoodInformation: boolean;
  readStateInformation: boolean;
  acceptsLocalRules: boolean;
  acceptsAllLiability: boolean;
  waivesPlatformLiability: boolean;
  maintainsCommissaryAccess: boolean;
  updatedAt: string;
};

export const EMPTY_SECTION_AGREEMENT: SectionAgreement = {
  readFoodInformation: false,
  readStateInformation: false,
  acceptsLocalRules: false,
  acceptsAllLiability: false,
  waivesPlatformLiability: false,
  maintainsCommissaryAccess: false,
  updatedAt: '',
};

export function sectionAgreementFromUnknown(value: unknown): SectionAgreement | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<SectionAgreement>;
  if (typeof row.readFoodInformation !== 'boolean') return null;
  return {
    readFoodInformation: row.readFoodInformation === true,
    readStateInformation: row.readStateInformation === true,
    acceptsLocalRules: row.acceptsLocalRules === true,
    acceptsAllLiability: row.acceptsAllLiability === true,
    waivesPlatformLiability: row.waivesPlatformLiability === true,
    maintainsCommissaryAccess: row.maintainsCommissaryAccess === true,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
  };
}

export function sectionAgreementReady(value: SectionAgreement): boolean {
  return value.readFoodInformation
    && value.readStateInformation
    && value.acceptsLocalRules
    && value.acceptsAllLiability
    && value.waivesPlatformLiability
    && value.maintainsCommissaryAccess;
}

export function evaluateSectionAgreement(value: unknown, missing: string): { ok: boolean; blocks: string[] } {
  const record = sectionAgreementFromUnknown(value);
  if (!record) return { ok: false, blocks: [missing] };
  const blocks: string[] = [];
  if (!record.readFoodInformation) blocks.push('Confirm that you read the in-app food handling information.');
  if (!record.readStateInformation) blocks.push('Confirm that you read the in-app state and local food-requirement information.');
  if (!record.acceptsLocalRules) blocks.push('Confirm that you will follow the food rules of your city, county, and state.');
  if (!record.acceptsAllLiability) blocks.push('Confirm that you take full responsibility and all liability for food you serve.');
  if (!record.waivesPlatformLiability) {
    blocks.push('Confirm the waiver for HomeCookedPlate, Appsolete, PUSL, LLC, and associated entities and individuals.');
  }
  if (!record.maintainsCommissaryAccess) {
    blocks.push('Confirm that, if a governing body requires a commissary kitchen, you will ensure access to an authorized kitchen and meet every requirement that comes with it.');
  }
  return { ok: blocks.length === 0, blocks };
}
