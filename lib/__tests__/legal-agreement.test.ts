import { agreementPredatesAccount, chooseLegalForm, type LegalAgreementRecord } from '../legal-agreement';

const sections = {
  jurisdictional_law: true as const,
  delivery_safety: true as const,
  liability_waiver: true as const,
  legal_safety_financial: true as const,
  allergy_food_safety: true as const,
  fee_structure: true as const,
  account_termination: true as const,
};

function record(acknowledgedOn: string, acknowledgedAt: string): LegalAgreementRecord {
  return { sections, acknowledgedOn, acknowledgedAt };
}

describe('chooseLegalForm', () => {
  const createdToday = new Date('2026-10-25T18:00:00.000Z');

  it('drops a 10/18 agreement left in the browser after that account was deleted', () => {
    const old = record('2026-10-18', '2026-10-18T15:00:00.000Z');
    expect(agreementPredatesAccount(old, createdToday)).toBe(true);
    expect(chooseLegalForm({
      signedIn: false,
      createdAt: null,
      account: null,
      device: old,
      legalReady: false,
      today: '2026-10-25',
    })).toBe('empty');
    expect(chooseLegalForm({
      signedIn: true,
      createdAt: createdToday,
      account: { ...old, sections },
      device: old,
      legalReady: false,
      today: '2026-10-25',
    })).toBe('empty');
  });

  it('keeps an agreement the current account made on or after the account existed', () => {
    const kept = record('2026-10-18', '2026-10-18T15:00:00.000Z');
    expect(chooseLegalForm({
      signedIn: true,
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      account: { ...kept, sections },
      device: null,
      legalReady: false,
      today: '2026-10-25',
    })).toBe('account');
  });

  it('drops a same-day copy that was saved before the new account existed', () => {
    const copied = record('2026-10-25', '2026-10-25T17:30:00.000Z');
    expect(agreementPredatesAccount(copied, createdToday)).toBe(true);
    expect(chooseLegalForm({
      signedIn: true,
      createdAt: createdToday,
      account: { ...copied, sections },
      device: copied,
      legalReady: false,
      today: '2026-10-25',
    })).toBe('empty');
  });

  it('keeps a confirmation finished today before sign-in', () => {
    const today = record('2026-10-25', '2026-10-25T17:30:00.000Z');
    expect(chooseLegalForm({
      signedIn: false,
      createdAt: null,
      account: null,
      device: today,
      legalReady: true,
      today: '2026-10-25',
    })).toBe('device');
    expect(chooseLegalForm({
      signedIn: true,
      createdAt: new Date('2026-10-25T18:00:00.000Z'),
      account: null,
      device: today,
      legalReady: true,
      today: '2026-10-25',
    })).toBe('device');
  });
});
