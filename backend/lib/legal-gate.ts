import { z } from 'zod';

/** Matches `APPLE_LICENSE_REVISION` in `lib/legal-agreement.ts`. */
export const APPLE_LICENSE_REVISION = '2026-11-05T21:30:00.000Z';

export const LEGAL_SIGN_IN_MESSAGE =
  'Complete the Legal & Safety page before signing in. Open that page, check each section, and enter today\'s date. Then return here and sign in.';

export const LEGAL_SAVE_FAILED_MESSAGE =
  'The Legal & Safety agreement could not be saved. Sign-in was not opened.';

const SECTION_IDS = [
  'jurisdictional_law',
  'delivery_safety',
  'liability_waiver',
  'legal_safety_financial',
  'allergy_food_safety',
  'fee_structure',
  'account_termination',
  'uploaded_content',
  'apple_eula',
] as const;

const sectionSchema = z.object({
  jurisdictional_law: z.literal(true),
  delivery_safety: z.literal(true),
  liability_waiver: z.literal(true),
  legal_safety_financial: z.literal(true),
  allergy_food_safety: z.literal(true),
  fee_structure: z.literal(true),
  account_termination: z.literal(true),
  uploaded_content: z.literal(true),
  apple_eula: z.literal(true),
});

export const legalSafetyAgreementSchema = z.object({
  sections: sectionSchema,
  acknowledgedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acknowledgedAt: z.string().min(10),
});

export const SIGNED_LEGAL_RECORD = {
  sections: {
    jurisdictional_law: true as const,
    delivery_safety: true as const,
    liability_waiver: true as const,
    legal_safety_financial: true as const,
    allergy_food_safety: true as const,
    fee_structure: true as const,
    account_termination: true as const,
    uploaded_content: true as const,
    apple_eula: true as const,
  },
  acknowledgedOn: '2026-11-05',
  acknowledgedAt: '2026-11-05T22:00:00.000Z',
};

type AgreementShape = {
  sections?: Partial<Record<(typeof SECTION_IDS)[number], boolean>>;
  acknowledgedOn?: string;
  acknowledgedAt?: string;
};

function asAgreement(value: unknown): AgreementShape | null {
  if (!value || typeof value !== 'object') return null;
  return value as AgreementShape;
}

function dated(record: AgreementShape): boolean {
  return typeof record.acknowledgedOn === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.acknowledgedOn)
    && typeof record.acknowledgedAt === 'string'
    && record.acknowledgedAt.length >= 10;
}

function agreementPredatesAccount(acknowledgedAt: string, createdAt: Date): boolean {
  const at = Date.parse(acknowledgedAt);
  if (Number.isNaN(at) || Number.isNaN(createdAt.getTime())) return true;
  return at < createdAt.getTime();
}

function appleLicenseCoversRevision(record: AgreementShape): boolean {
  if (record.sections?.apple_eula !== true) return false;
  const at = Date.parse(record.acknowledgedAt ?? '');
  if (Number.isNaN(at)) return false;
  return at >= Date.parse(APPLE_LICENSE_REVISION);
}

function completedAgreement(value: unknown): AgreementShape | null {
  const record = asAgreement(value);
  if (!record?.sections || !dated(record)) return null;
  for (const id of SECTION_IDS) {
    if (record.sections[id] !== true) return null;
  }
  if (!appleLicenseCoversRevision(record)) return null;
  return record;
}

function needsAppleLicenseRecheck(value: unknown, createdAt: Date): boolean {
  const record = asAgreement(value);
  if (!record?.sections || !dated(record)) return false;
  for (const id of SECTION_IDS) {
    if (id === 'apple_eula') continue;
    if (record.sections[id] !== true) return false;
  }
  if (agreementPredatesAccount(record.acknowledgedAt as string, createdAt)) return false;
  return !appleLicenseCoversRevision(record);
}

/** A PlateMaker and a PlateTaker both need this on the profile before a session is used. */
export function accountAllowsSignIn(value: unknown, createdAt: Date): boolean {
  if (Number.isNaN(createdAt.getTime())) return false;
  const completed = completedAgreement(value);
  if (completed && !agreementPredatesAccount(completed.acknowledgedAt as string, createdAt)) return true;
  return needsAppleLicenseRecheck(value, createdAt);
}

export function submittedAgreementAllows(value: unknown, createdAt: Date): boolean {
  const completed = completedAgreement(value);
  if (!completed) return false;
  return !agreementPredatesAccount(completed.acknowledgedAt as string, createdAt);
}

/**
 * `save` must be written before the session is returned. A failed write is a refusal
 * even when an older row would have allowed sign-in.
 */
export function legalSignInDecision(input: {
  stored: unknown;
  submitted?: unknown;
  createdAt: Date;
}): 'save' | 'allow' | 'refuse' {
  if (input.submitted != null) {
    return submittedAgreementAllows(input.submitted, input.createdAt) ? 'save' : 'refuse';
  }
  return accountAllowsSignIn(input.stored, input.createdAt) ? 'allow' : 'refuse';
}

export async function profileAllowsSignIn(
  admin: { from: (table: string) => any },
  userId: string,
): Promise<boolean> {
  const row = await admin
    .from('profiles')
    .select('legal_safety_agreement, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (row.error || !row.data?.created_at) return false;
  return accountAllowsSignIn(row.data.legal_safety_agreement, new Date(row.data.created_at));
}
