import { confirmationPath } from '@/lib/verification-link';

function authLink(path: string): string | null {
  return confirmationPath(path);
}

export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  try {
    return authLink(path) ?? '/';
  } catch {
    return '/';
  }
}
