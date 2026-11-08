import { METRO_CENTERS } from './metro-radius';
import { buyerPremiumCovers, type TrialAccessProfile } from './trial-access';

/** PlateTaker Premium. A cook plan does not open another city. */
export function travelBrowseOpen(profile: TrialAccessProfile | null | undefined): boolean {
  return Boolean(profile && buyerPremiumCovers(profile));
}

/**
 * A typed city matches a saved metro name.
 * "New York" matches New York-Newark-Jersey City.
 */
export function metrosForTravelPlace(place: string): string[] {
  const needle = place.trim().toLowerCase();
  if (needle.length < 4) return [];
  return METRO_CENTERS
    .filter((metro) => metro.name.toLowerCase().includes(needle))
    .map((metro) => metro.name);
}
