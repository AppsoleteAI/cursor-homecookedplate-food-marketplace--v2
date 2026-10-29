/** Remote/Other PlateMaker period. This is not Early Bird. Early Bird stays on a named metro. */
export const REMOTE_KITCHEN_DAYS = 120;

export function canStartRemoteKitchen(input: {
  role: string | null;
  metroArea: string | null;
  paid: boolean;
  trialEndsAt: string | null;
}): boolean {
  if (input.role !== 'platemaker') return false;
  if (input.paid) return false;
  const metro = (input.metroArea || '').trim();
  if (metro && metro !== 'Remote/Other') return false;
  if (input.trialEndsAt) return false;
  return true;
}
