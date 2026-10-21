/** The payout clock waits until both the cook and the buyer confirm pickup. */
export function pickupConfirmedByBoth(roles: ('buyer' | 'seller')[]): boolean {
  return roles.includes('buyer') && roles.includes('seller');
}

export function orderStatusAllowed(role: 'buyer' | 'seller', current: string, next: string): boolean {
  if (role === 'seller' && (current === 'accepted' || current === 'preparing') && next === 'ready') return true;
  if ((role === 'seller' || role === 'buyer') && current === 'ready' && next === 'completed') return true;
  if (role === 'buyer' && current === 'pending' && next === 'cancelled') return true;
  return false;
}
