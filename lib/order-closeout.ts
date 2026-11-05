export type CloseoutStatus = 'ready' | 'completed';

export const RECEIPT_ACK_COPY =
  'Both the PlateMaker and the PlateTaker must acknowledge that the food item(s) were paid for and received.';

export const PLATEMAKER_RECEIPT_STATEMENT =
  'I acknowledge these food item(s) were paid for and the PlateTaker received them.';

export const PLATETAKER_RECEIPT_STATEMENT =
  'I acknowledge these food item(s) were paid for and I received them.';

/** The one next step a cook or a buyer can take on a plate order. The cook can clear it only after the buyer has acknowledged receipt. */
export function orderCloseout(
  role: string | null | undefined,
  status: string,
  alreadyConfirmed = false,
  buyerAccepted = false,
): { label: string; next: CloseoutStatus } | null {
  if (role === 'platemaker' && (status === 'accepted' || status === 'preparing')) {
    return { label: 'Ready for pickup', next: 'ready' };
  }
  if (status !== 'ready' || alreadyConfirmed) return null;
  if (role === 'platetaker') return { label: 'Send', next: 'completed' };
  if (role === 'platemaker' && buyerAccepted) return { label: 'Send', next: 'completed' };
  return null;
}
