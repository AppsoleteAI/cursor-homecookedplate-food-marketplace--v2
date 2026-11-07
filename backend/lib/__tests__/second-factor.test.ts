import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mfaLookupState,
  readAccessTokenAal,
  sessionMayEnter,
  verifiedFactors,
  verifiedTotpFactorId,
} from '../second-factor';

function token(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${body}.sig`;
}

describe.each(['platemaker', 'platetaker'] as const)('second factor for a %s', () => {
  it('allows a normal session and rejects an authenticator session that is still aal1', () => {
    expect(sessionMayEnter('aal1', 0, false)).toBe(true);
    expect(sessionMayEnter('aal2', 1, false)).toBe(true);
    expect(sessionMayEnter('aal1', 1, false)).toBe(false);
    expect(sessionMayEnter(null, 1, false)).toBe(false);
    expect(sessionMayEnter('aal1', 0, true)).toBe(false);
    expect(mfaLookupState(undefined)).toBe('ok');
    expect(mfaLookupState('MFA enroll is disabled')).toBe('off');
    expect(mfaLookupState('fetch failed')).toBe('failed');
  });

  it('reads the assurance level from the access token', () => {
    expect(readAccessTokenAal(token({ aal: 'aal1' }))).toBe('aal1');
    expect(readAccessTokenAal(token({ aal: 'aal2' }))).toBe('aal2');
    expect(readAccessTokenAal(token({ sub: 'account' }))).toBeNull();
    expect(readAccessTokenAal('not-a-token')).toBeNull();
  });

  it('uses a verified authenticator factor and ignores one that is not finished', () => {
    const factors = [
      { id: '11111111-1111-4111-8111-111111111111', factor_type: 'totp', status: 'unverified' },
      { id: '22222222-2222-4222-8222-222222222222', factor_type: 'totp', status: 'verified' },
    ];
    expect(verifiedFactors(factors)).toHaveLength(1);
    expect(verifiedTotpFactorId(factors)).toBe('22222222-2222-4222-8222-222222222222');
    expect(verifiedTotpFactorId([{ id: '33333333-3333-4333-8333-333333333333', factor_type: 'phone', status: 'verified' }])).toBeNull();
  });
});

describe('second factor is locked in the database scripts', () => {
  it('locks the authenticator and pause columns and rejects an unfinished token', () => {
    const lock = readFileSync(resolve(__dirname, '../../sql/protect_membership_columns.sql'), 'utf8');
    const gate = readFileSync(resolve(__dirname, '../../sql/require_second_factor.sql'), 'utf8');
    expect(lock).toContain("'two_factor_enabled'");
    expect(lock).toContain("'is_paused'");
    expect(gate).toContain('session_completed_second_factor');
    expect(gate).toContain("auth.jwt()->>'aal'");
    expect(gate).toContain("status = 'verified'");
  });
});
