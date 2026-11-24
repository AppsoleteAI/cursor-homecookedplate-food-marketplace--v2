export type ScreenEntry = "wait" | "sign-in" | "home" | "open";

/** Home kitchen and the other cook-only agreement screens use this gate. */
export function sellerScreenEntry(input: {
  loading: boolean;
  signedIn: boolean;
  role: string | null | undefined;
  isAdmin?: boolean;
  browsing?: string | null;
}): ScreenEntry {
  if (input.loading) return "wait";
  if (!input.signedIn) {
    if (input.browsing === "platemaker") return "open";
    if (input.browsing === "platetaker") return "home";
    return "sign-in";
  }
  if (input.role === "platemaker" || input.isAdmin === true) return "open";
  return "home";
}
