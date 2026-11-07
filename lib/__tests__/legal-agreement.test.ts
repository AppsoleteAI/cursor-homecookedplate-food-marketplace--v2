import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appleLicenseParagraphs } from '../apple-eula';
import { agreementFromUnknown, agreementPredatesAccount, chooseLegalForm, emptyLegalSections, needsAppleLicenseRecheck, priorAgreementFromUnknown, type LegalAgreementRecord } from '../legal-agreement';

const sections = {
  jurisdictional_law: true as const,
  delivery_safety: true as const,
  liability_waiver: true as const,
  legal_safety_financial: true as const,
  allergy_food_safety: true as const,
  fee_structure: true as const,
  account_termination: true as const,
  uploaded_content: true as const,
  apple_eula: true as const,
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

describe('Apple app license re-check', () => {
  const created = new Date('2026-10-01T12:00:00.000Z');
  const older = {
    sections: { ...sections, apple_eula: false as const },
    acknowledgedOn: '2026-10-18',
    acknowledgedAt: '2026-10-18T15:00:00.000Z',
  };

  it('keeps the older sections and leaves the Apple app license unchecked', () => {
    expect(emptyLegalSections().apple_eula).toBe(false);
    const prior = priorAgreementFromUnknown(older);
    expect(prior?.sections.apple_eula).toBe(false);
    expect(prior?.sections.uploaded_content).toBe(true);
    expect(needsAppleLicenseRecheck(older, created)).toBe(true);
  });

  it('asks again when the Apple app license was checked before this wording', () => {
    const done = { ...older, sections };
    expect(needsAppleLicenseRecheck(done, created)).toBe(true);
    expect(agreementFromUnknown(done)).toBeNull();
    expect(needsAppleLicenseRecheck(null, created)).toBe(false);
  });

  it('does not ask again when the Apple app license check is after this wording', () => {
    const done = {
      ...older,
      sections,
      acknowledgedOn: '2026-11-05',
      acknowledgedAt: '2026-11-05T22:00:00.000Z',
    };
    expect(needsAppleLicenseRecheck(done, created)).toBe(false);
    expect(agreementFromUnknown(done)?.sections.apple_eula).toBe(true);
  });

  it('publishes the same Apple app license on the public terms page', () => {
    const html = readFileSync(resolve(__dirname, '../../pages/legal/terms.html'), 'utf8');
    const paragraphs = appleLicenseParagraphs();
    expect(paragraphs[0]).toContain('Volume Content Terms');
    expect(paragraphs[1]).toContain('volume purchasing');
    expect(paragraphs[4]).toContain('HealthKit and HomeKit');
    for (const [index, paragraph] of paragraphs.entries()) {
      if (index === 7) continue;
      expect(html).toContain(paragraph);
    }
  });

  it('does not treat a deleted account copy as the re-check', () => {
    expect(needsAppleLicenseRecheck(older, new Date('2026-11-02T18:00:00.000Z'))).toBe(false);
  });
});
