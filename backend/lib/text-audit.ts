import { sanitizeTextArray, sanitizeTextField } from './text-security';

type AdminLike = { from: (table: string) => { insert: (row: object) => PromiseLike<unknown> } } | null | undefined;

/** Stores flag names and the field name. The text itself is not stored. */
export async function recordTextFlags(
  admin: AdminLike,
  userId: string | null | undefined,
  field: string,
  flags: string[],
  blocked: boolean,
): Promise<void> {
  if (!admin || !userId || flags.length === 0) return;
  await Promise.resolve(
    admin.from('audit_logs').insert({
      action: blocked ? 'TEXT_BLOCKED' : 'TEXT_FLAGGED',
      user_id: userId,
      new_data: { field, flags: [...new Set(flags)] },
    }),
  ).catch(() => {});
}

export async function auditTextField(
  admin: AdminLike,
  userId: string | null | undefined,
  field: string,
  input: string,
): Promise<{ value: string; blocked: boolean; flags: string[] }> {
  const scanned = sanitizeTextField(input);
  await recordTextFlags(admin, userId, field, scanned.flags, scanned.blocked);
  return scanned;
}

export async function auditTextList(
  admin: AdminLike,
  userId: string | null | undefined,
  field: string,
  items: string[],
): Promise<{ values: string[]; blocked: boolean; flags: string[] }> {
  const scanned = sanitizeTextArray(items);
  await recordTextFlags(admin, userId, field, scanned.flags, scanned.blocked);
  return scanned;
}
