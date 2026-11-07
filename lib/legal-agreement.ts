import AsyncStorage from '@react-native-async-storage/async-storage';
import { TERMS_OF_SERVICE_URL } from '@/constants/urls';

/** Signed out, both roles read the public terms. Signed in, the account holds the acknowledgment. */
export function legalSurface(signedIn: boolean): { kind: 'account' | 'public-terms'; url: string | null } {
  if (signedIn) return { kind: 'account', url: null };
  return { kind: 'public-terms', url: TERMS_OF_SERVICE_URL };
}

export const LEGAL_SECTION_IDS = [
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

export type LegalSectionId = (typeof LEGAL_SECTION_IDS)[number];

export type LegalAgreementRecord = {
  sections: Record<LegalSectionId, boolean>;
  acknowledgedOn: string;
  acknowledgedAt: string;
};

export type CompletedLegalAgreement = {
  sections: { [K in LegalSectionId]: true };
  acknowledgedOn: string;
  acknowledgedAt: string;
};

/** Acceptances before this instant checked the shorter Apple app license. */
export const APPLE_LICENSE_REVISION = '2026-11-05T21:30:00.000Z';

const STORAGE_KEY = 'legal_safety_agreement';
const READY_KEY = 'hcp_legal_ready';

export const LEGAL_SIGN_IN_MESSAGE =
  'Complete the Legal & Safety page before signing in. Open that page, check each section, and enter today\'s date. Then return here and sign in.';

let loginLegalBoxChecked = false;

export function isLoginLegalBoxChecked(): boolean {
  return loginLegalBoxChecked;
}

export function setLoginLegalBoxChecked(checked: boolean): void {
  loginLegalBoxChecked = checked;
}

export function clearLoginLegalBox(): void {
  loginLegalBoxChecked = false;
}

export function emptyLegalSections(): Record<LegalSectionId, boolean> {
  return {
    jurisdictional_law: false,
    delivery_safety: false,
    liability_waiver: false,
    legal_safety_financial: false,
    allergy_food_safety: false,
    fee_structure: false,
    account_termination: false,
    uploaded_content: false,
    apple_eula: false,
  };
}

/** An older agreement that already has every section except the Apple app license. */
export function priorAgreementFromUnknown(value: unknown): LegalAgreementRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<LegalAgreementRecord>;
  if (!raw.sections || typeof raw.acknowledgedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.acknowledgedOn)) {
    return null;
  }
  if (typeof raw.acknowledgedAt !== 'string' || raw.acknowledgedAt.length < 10) return null;
  const sections = emptyLegalSections();
  for (const id of LEGAL_SECTION_IDS) {
    if (id === 'apple_eula') continue;
    if (raw.sections[id] !== true) return null;
    sections[id] = true;
  }
  sections.apple_eula = raw.sections.apple_eula === true;
  return {
    sections,
    acknowledgedOn: raw.acknowledgedOn,
    acknowledgedAt: raw.acknowledgedAt,
  };
}

/** The stored Apple app license includes the Schedule 1 Exhibit B wording from 5 November 2026. */
export function appleLicenseCoversRevision(record: {
  sections: { apple_eula?: boolean };
  acknowledgedAt?: string;
}): boolean {
  if (record.sections.apple_eula !== true) return false;
  const at = Date.parse(record.acknowledgedAt ?? '');
  if (Number.isNaN(at)) return false;
  return at >= Date.parse(APPLE_LICENSE_REVISION);
}

/** Sign-in stays open. The Apple app license is checked on Legal & Safety after sign-in. */
export function needsAppleLicenseRecheck(value: unknown, createdAt: Date): boolean {
  const prior = priorAgreementFromUnknown(value);
  if (!prior || agreementPredatesAccount(prior, createdAt)) return false;
  return !appleLicenseCoversRevision(prior);
}

export function todayStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function todayDisplay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}/${day}/${now.getFullYear()}`;
}

export function parseEnteredDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function allSectionsAgreed(sections: Record<LegalSectionId, boolean>): boolean {
  return LEGAL_SECTION_IDS.every((id) => sections[id] === true);
}

export function isLegalAgreementComplete(record: LegalAgreementRecord | null): boolean {
  if (!record) return false;
  return allSectionsAgreed(record.sections) && /^\d{4}-\d{2}-\d{2}$/.test(record.acknowledgedOn);
}

export function toCompletedLegalAgreement(
  record: LegalAgreementRecord | null
): CompletedLegalAgreement | null {
  if (!record || !isLegalAgreementComplete(record)) return null;
  const sections = {} as CompletedLegalAgreement['sections'];
  for (const id of LEGAL_SECTION_IDS) {
    sections[id] = true;
  }
  return {
    sections,
    acknowledgedOn: record.acknowledgedOn,
    acknowledgedAt: record.acknowledgedAt,
  };
}

/** Accept a stored account or device record only when every section and the date are present. */
export function agreementFromUnknown(value: unknown): CompletedLegalAgreement | null {
  if (!value || typeof value !== 'object') return null;
  const completed = toCompletedLegalAgreement(value as LegalAgreementRecord);
  if (!completed || !appleLicenseCoversRevision(completed)) return null;
  return completed;
}

export async function readLegalAgreement(): Promise<LegalAgreementRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegalAgreementRecord;
    if (!parsed?.sections || !parsed.acknowledgedOn) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLegalAgreement(record: LegalAgreementRecord): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function clearLegalAgreement(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** The acknowledgment was stored before this account existed, so it belongs to an earlier account. */
export function agreementPredatesAccount(
  record: { acknowledgedAt: string },
  createdAt: Date,
): boolean {
  const at = Date.parse(record.acknowledgedAt);
  if (Number.isNaN(at)) return true;
  return at < createdAt.getTime();
}

export function chooseLegalForm(input: {
  signedIn: boolean;
  createdAt: Date | null;
  account: CompletedLegalAgreement | null;
  device: LegalAgreementRecord | null;
  legalReady: boolean;
  today: string;
}): 'account' | 'device' | 'empty' {
  const accountOk = Boolean(
    input.signedIn &&
    input.account &&
    input.createdAt &&
    !agreementPredatesAccount(input.account, input.createdAt),
  );
  if (accountOk) return 'account';

  const deviceComplete = toCompletedLegalAgreement(input.device);
  const deviceToday = Boolean(
    deviceComplete &&
    input.legalReady &&
    deviceComplete.acknowledgedOn === input.today,
  );
  if (deviceToday) return 'device';
  return 'empty';
}

/** Set when this device just finished the Legal & Safety page. An older saved copy does not count. */
export async function markLegalReadyForSignIn(): Promise<void> {
  await AsyncStorage.setItem(READY_KEY, new Date().toISOString());
}

export async function isLegalReadyForSignIn(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(READY_KEY);
    return Boolean(value);
  } catch {
    return false;
  }
}

export async function clearLegalReadyForSignIn(): Promise<void> {
  await AsyncStorage.removeItem(READY_KEY);
}

/** Email, Apple, and Google sign-in use this same Legal & Safety gate. */
export async function applySignInLegal(createdAt: Date, accountRecord: unknown): Promise<'ok' | 'block'> {
  const storedAgreement = await readLegalAgreement();
  const localAgreement = toCompletedLegalAgreement(storedAgreement);
  const accountAgreement = agreementFromUnknown(accountRecord);
  const accountOk = Boolean(accountAgreement && !agreementPredatesAccount(accountAgreement, createdAt));
  const legalReady = await isLegalReadyForSignIn();
  const localOk = chooseLegalForm({
    signedIn: true,
    createdAt,
    account: null,
    device: storedAgreement,
    legalReady,
    today: todayStamp(),
  }) === 'device';
  const appleRecheck = needsAppleLicenseRecheck(accountRecord, createdAt);
  if (!accountOk && !localOk && !appleRecheck) {
    if (localAgreement) {
      await clearLegalAgreement();
      await clearLegalReadyForSignIn();
    }
    return 'block';
  }
  if (accountOk && accountAgreement && !localOk) {
    try {
      await writeLegalAgreement(accountAgreement);
    } catch (storageError) {
      console.error('[Login] Could not save the Legal & Safety agreement on this device', storageError);
    }
  }
  if (accountOk && accountAgreement) {
    setLoginLegalBoxChecked(true);
    await clearLegalReadyForSignIn();
  }
  return 'ok';
}
