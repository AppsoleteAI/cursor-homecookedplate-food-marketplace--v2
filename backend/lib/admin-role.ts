export type AdminRole = 'main' | 'monitor';

type AdminFlags = {
  is_admin?: boolean | null;
  main_admin?: boolean | null;
  monitor_admin?: boolean | null;
};

/**
 * Main admin is the owner checkbox. Monitor admin is the limited checkbox.
 * Before those columns exist, an is_admin account is treated as the main admin.
 */
export function readAdminRole(profile: AdminFlags | null | undefined): AdminRole | null {
  if (!profile) return null;
  if (profile.main_admin === true) return 'main';
  if (profile.monitor_admin === true) return 'monitor';
  if (profile.is_admin === true && profile.main_admin == null && profile.monitor_admin == null) {
    return 'main';
  }
  return null;
}

export function adminIdsFromProfiles(rows: (AdminFlags & { id?: string | null })[]): string[] {
  return rows
    .filter((row) => typeof row.id === 'string' && row.id.length > 0 && readAdminRole(row) != null)
    .map((row) => row.id as string);
}

export function reviewReportNotice(mealName?: string | null): { title: string; body: string } {
  const plate = (mealName || '').trim();
  const body = plate
    ? `A review comment on ${plate} was reported. An admin can remove the words.`
    : 'A review comment was reported. An admin can remove the words.';
  return { title: 'Review report', body };
}
