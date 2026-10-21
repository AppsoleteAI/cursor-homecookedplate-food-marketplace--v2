/** Email alone does not turn a paused account back on. The password has to match. */
export function reactivateTurnsAccountOn(passwordMatched: boolean, isPaused: boolean): boolean {
  return passwordMatched === true && isPaused === true;
}

export function accountSecurityColumns(input: { isPaused?: boolean; twoFactorEnabled?: boolean }) {
  const updateData: { is_paused?: boolean; two_factor_enabled?: boolean } = {};
  if (input.isPaused !== undefined) updateData.is_paused = input.isPaused;
  if (input.twoFactorEnabled !== undefined) updateData.two_factor_enabled = input.twoFactorEnabled;
  return updateData;
}
