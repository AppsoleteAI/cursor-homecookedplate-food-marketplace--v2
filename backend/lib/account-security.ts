export function accountSecurityColumns(input: { isPaused?: boolean; twoFactorEnabled?: boolean }) {
  const updateData: { is_paused?: boolean; two_factor_enabled?: boolean } = {};
  if (input.isPaused !== undefined) updateData.is_paused = input.isPaused;
  if (input.twoFactorEnabled !== undefined) updateData.two_factor_enabled = input.twoFactorEnabled;
  return updateData;
}
