export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  try {
    return initial || path ? '/' : '/';
  } catch {
    return '/';
  }
}
