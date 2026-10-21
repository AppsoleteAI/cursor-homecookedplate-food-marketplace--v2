export type CloseoutStatus = 'ready' | 'completed';

/** The one next step a cook or a buyer can take on a plate order. */
export function orderCloseout(
  role: string | null | undefined,
  status: string,
  alreadyConfirmed = false,
): { label: string; next: CloseoutStatus } | null {
  if (role === 'platemaker' && (status === 'accepted' || status === 'preparing')) {
    return { label: 'Ready for pickup', next: 'ready' };
  }
  if (status === 'ready' && alreadyConfirmed) return null;
  if (status === 'ready' && (role === 'platemaker' || role === 'platetaker')) {
    return { label: role === 'platemaker' ? 'Picked up' : 'I picked this up', next: 'completed' };
  }
  return null;
}
