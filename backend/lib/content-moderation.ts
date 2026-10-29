import { notifyParty } from './account-notice';
import { adminIdsFromProfiles } from './admin-role';

type Admin = { from: (table: string) => any };

export function missingColumn(message: string | undefined, column: string): boolean {
  return typeof message === 'string' && /column/i.test(message) && message.includes(column);
}

/** The buyer wrote the note. The cook does not see it until a moderator allows it. */
export function noteForViewer(input: {
  text: string | null | undefined;
  status: string | null | undefined;
  buyerId: string;
  sellerId: string;
  viewerId: string;
}): { text: string | null; status: string | null } {
  const status = input.status ?? null;
  const text = typeof input.text === 'string' && input.text.trim() ? input.text : null;
  if (!text) return { text: null, status };
  if (status === 'removed') return { text: null, status };
  if (status === 'pending' && input.viewerId === input.sellerId && input.viewerId !== input.buyerId) {
    const offer = text.split('\n').filter((line) => line.startsWith('Free item:')).join('\n');
    return { text: offer || null, status };
  }
  return { text, status };
}

export function commentForViewer(
  comment: string | null | undefined,
  status: string | null | undefined,
  authorId: string | null | undefined,
  viewerId: string | null | undefined,
): { comment: string | null; commentStatus: string | null } {
  const commentStatus = status ?? null;
  const words = typeof comment === 'string' && comment.trim() ? comment : null;
  if (!words) return { comment: null, commentStatus };
  if (commentStatus === 'removed') return { comment: null, commentStatus };
  if (commentStatus === 'pending' && viewerId !== authorId) return { comment: null, commentStatus };
  return { comment: words, commentStatus };
}

export function messageVisible(status: string | null | undefined, senderId: string, viewerId: string): boolean {
  const held = status || 'allowed';
  if (held === 'removed') return false;
  if (held === 'pending' && senderId !== viewerId) return false;
  return true;
}

export async function notifyModerators(
  admin: Admin,
  exceptUserId: string | null,
  notice: { title: string; body: string },
): Promise<void> {
  const withRoles = await admin
    .from('profiles')
    .select('id, is_admin, main_admin, monitor_admin')
    .or('is_admin.eq.true,main_admin.eq.true,monitor_admin.eq.true');
  const admins = withRoles.error
    ? await admin.from('profiles').select('id, is_admin').eq('is_admin', true)
    : withRoles;
  const rows = (admins.data || []) as { id?: string | null; is_admin?: boolean | null; main_admin?: boolean | null; monitor_admin?: boolean | null }[];
  for (const adminId of adminIdsFromProfiles(rows)) {
    if (adminId === exceptUserId) continue;
    try {
      await notifyParty(admin, adminId, 'orderUpdates', notice, { evenWhenKindOff: true });
    } catch (error) {
      console.error('[Moderator] An admin was not told:', error);
    }
  }
}
