import { accountSecurityColumns } from '../account-security';

describe('account security columns', () => {
  it('maps pause and two-factor onto profile columns', () => {
    expect(accountSecurityColumns({ isPaused: true })).toEqual({ is_paused: true });
    expect(accountSecurityColumns({ twoFactorEnabled: false })).toEqual({ two_factor_enabled: false });
    expect(accountSecurityColumns({ isPaused: false, twoFactorEnabled: true })).toEqual({
      is_paused: false,
      two_factor_enabled: true,
    });
  });
});
