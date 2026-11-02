import {
  evaluateSectionAgreement,
  sectionAgreementFromUnknown,
  SECTION_AGREEMENT_RULE,
  type SectionAgreement,
} from '@/lib/section-agreement';

export const KITCHEN_PERMIT_RULE = SECTION_AGREEMENT_RULE;

export const KITCHEN_AGREEMENT_BLOCK =
  'Save the home-kitchen agreement before a cooked plate goes on the menu.';

export type KitchenPermitRecord = SectionAgreement;

export function kitchenPermitFromUnknown(value: unknown): KitchenPermitRecord | null {
  return sectionAgreementFromUnknown(value);
}

export function evaluateKitchenPermit(value: unknown): { ok: boolean; blocks: string[] } {
  return evaluateSectionAgreement(value, KITCHEN_AGREEMENT_BLOCK);
}
