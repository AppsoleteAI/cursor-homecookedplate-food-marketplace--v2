import { accountSecurityColumns, reactivateTurnsAccountOn } from '../account-security';
import { adminIdsFromProfiles, reviewReportNotice } from '../admin-role';

describe('account security columns', () => {
  it('maps pause and two-factor onto profile columns', () => {
    expect(accountSecurityColumns({ isPaused: true })).toEqual({ is_paused: true });
    expect(accountSecurityColumns({ twoFactorEnabled: false })).toEqual({ two_factor_enabled: false });
    expect(accountSecurityColumns({ isPaused: false, twoFactorEnabled: true })).toEqual({
      is_paused: false,
      two_factor_enabled: true,
    });
  });

  it('turns a paused account back on only after the password matches', () => {
    expect(reactivateTurnsAccountOn(false, true)).toBe(false);
    expect(reactivateTurnsAccountOn(true, false)).toBe(false);
    expect(reactivateTurnsAccountOn(true, true)).toBe(true);
  });

  it('tells an admin which plate had a reported comment', () => {
    expect(adminIdsFromProfiles([
      { id: 'admin-1', is_admin: true },
      { id: 'cook-1', is_admin: false },
    ])).toEqual(['admin-1']);
    expect(reviewReportNotice('Sunday gravy').body).toContain('Sunday gravy');
    expect(reviewReportNotice('Sunday gravy').body).toContain('An admin can remove the words.');
  });
});
