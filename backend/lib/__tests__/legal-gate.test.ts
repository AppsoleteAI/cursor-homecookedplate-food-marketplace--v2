import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { agreementFromUnknown, agreementPredatesAccount, LEGAL_SIGN_IN_MESSAGE as clientMessage, needsAppleLicenseRecheck } from '@/lib/legal-agreement';
import {
  accountAllowsSignIn,
  LEGAL_SIGN_IN_MESSAGE,
  legalSignInDecision,
  SIGNED_LEGAL_RECORD,
} from '../legal-gate';

const created = new Date('2026-10-01T12:00:00.000Z');

function clientAllows(value: unknown, createdAt: Date): boolean {
  const completed = agreementFromUnknown(value);
  if (completed && !agreementPredatesAccount(completed, createdAt)) return true;
  return needsAppleLicenseRecheck(value, createdAt);
}

const prior = {
  sections: { ...SIGNED_LEGAL_RECORD.sections, apple_eula: false as const },
  acknowledgedOn: '2026-10-18',
  acknowledgedAt: '2026-10-18T15:00:00.000Z',
};

describe.each(['platemaker', 'platetaker'] as const)('legal sign-in gate for a %s', () => {
  it('matches the account check and refuses a missing agreement', () => {
    expect(LEGAL_SIGN_IN_MESSAGE).toBe(clientMessage);
    expect(accountAllowsSignIn(null, created)).toBe(clientAllows(null, created));
    expect(accountAllowsSignIn(SIGNED_LEGAL_RECORD, created)).toBe(true);
    expect(accountAllowsSignIn(prior, created)).toBe(clientAllows(prior, created));
    expect(legalSignInDecision({ stored: null, createdAt: created })).toBe('refuse');
    expect(legalSignInDecision({ stored: SIGNED_LEGAL_RECORD, createdAt: created })).toBe('allow');
    expect(legalSignInDecision({ stored: prior, createdAt: created })).toBe('allow');
  });

  it('does not keep the session when the agreement being saved is refused', () => {
    expect(legalSignInDecision({
      stored: SIGNED_LEGAL_RECORD,
      submitted: { ...prior, sections: SIGNED_LEGAL_RECORD.sections, acknowledgedAt: '2026-10-01T00:00:00.000Z' },
      createdAt: created,
    })).toBe('refuse');
    expect(legalSignInDecision({
      stored: null,
      submitted: SIGNED_LEGAL_RECORD,
      createdAt: created,
    })).toBe('save');
  });
});

describe('sign-in code is not an unsalted hash', () => {
  it('does not store a Math.random code hash in audit logs', () => {
    const login = readFileSync(resolve(__dirname, '../../trpc/routes/auth/login/route.ts'), 'utf8');
    const verifier = readFileSync(resolve(__dirname, '../second-factor.ts'), 'utf8');
    expect(login).not.toContain('Math.random');
    expect(login).not.toContain('SIGN_IN_CODE');
    expect(login).not.toContain('sha256');
    expect(verifier).toContain('/verify');
    expect(verifier).not.toContain('audit_logs');
    expect(verifier).not.toContain('SHA-256');
  });
});
