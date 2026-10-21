/** A named metro has a headcount. Remote/Other does not. */

type Admin = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function namedMetro(area: string | null | undefined): string | null {
  const name = (area || '').trim();
  if (!name || name === 'Remote/Other') return null;
  return name;
}

/** Move one person off the old metro and onto the new one. A full new metro blocks the move. */
export async function moveMetroHeadcount(
  admin: Admin,
  role: string | null | undefined,
  fromArea: string | null | undefined,
  toArea: string | null | undefined,
): Promise<{ moved: boolean; blocked: boolean }> {
  const from = namedMetro(fromArea);
  const to = namedMetro(toArea);
  if (from === to) return { moved: false, blocked: false };
  const userRole = role === 'platemaker' || role === 'platetaker' ? role : null;
  if (!userRole) return { moved: false, blocked: true };

  if (to) {
    const { data, error } = await admin.rpc('increment_metro_count', {
      metro_name_param: to,
      user_role: userRole,
    });
    if (error) throw new Error(error.message || 'Could not save this metro.');
    if (data === 'CAP_REACHED') return { moved: false, blocked: true };
  }

  if (from) {
    const column = userRole === 'platemaker' ? 'platemaker_count' : 'platetaker_count';
    const current = await admin.from('metro_area_counts').select(column).eq('metro_name', from).maybeSingle();
    const count = Number(current.data?.[column] ?? 0);
    if (current.data && count > 0) {
      await admin.from('metro_area_counts').update({
        [column]: count - 1,
        updated_at: new Date().toISOString(),
      }).eq('metro_name', from);
    }
  }

  return { moved: true, blocked: false };
}

/** Puts the count back when the profile row did not save. */
export async function undoMetroHeadcount(
  admin: Admin,
  role: string | null | undefined,
  fromArea: string | null | undefined,
  toArea: string | null | undefined,
): Promise<void> {
  try {
    const back = await moveMetroHeadcount(admin, role, toArea, fromArea);
    if (!back.blocked) return;
  } catch {
    // The new metro still needs to lose the count that did not stick.
  }
  const to = namedMetro(toArea);
  const userRole = role === 'platemaker' || role === 'platetaker' ? role : null;
  if (!to || !userRole) return;
  const column = userRole === 'platemaker' ? 'platemaker_count' : 'platetaker_count';
  const current = await admin.from('metro_area_counts').select(column).eq('metro_name', to).maybeSingle();
  const count = Number(current.data?.[column] ?? 0);
  if (current.data && count > 0) {
    await admin.from('metro_area_counts').update({
      [column]: count - 1,
      updated_at: new Date().toISOString(),
    }).eq('metro_name', to);
  }
}
