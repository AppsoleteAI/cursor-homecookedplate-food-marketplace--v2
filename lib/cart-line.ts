/** The public menu keeps a plate only while that cook is taking orders. */
export function publicMenuKeepsPlate(
  paused: boolean | null | undefined,
  availableForOrders: boolean | null | undefined,
): boolean {
  return paused !== true && availableForOrders === true;
}

/** A stored cart line closes when the plate is gone or the cook is not taking orders. */
export function storedCartLineIsClosed(acceptingOrders: boolean | undefined, plateMissing: boolean): boolean {
  if (plateMissing) return true;
  return acceptingOrders === false;
}

/** A buyer can open a plate link only while that cook is taking orders. The cook can still open their own plate. */
export function buyerPlateLinkOpens(
  paused: boolean | null | undefined,
  availableForOrders: boolean | null | undefined,
  isOwner: boolean,
): boolean {
  if (isOwner) return true;
  return publicMenuKeepsPlate(paused, availableForOrders);
}

/** A saved favorite stays on the buyer dashboard only while that plate can still be ordered. */
export function savedFavoriteStaysOnDashboard(acceptingOrders: boolean | undefined, plateMissing: boolean): boolean {
  return !storedCartLineIsClosed(acceptingOrders, plateMissing);
}
