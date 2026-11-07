import { timingSafeEqual } from 'node:crypto';

/** Compares two secrets without returning on the first differing byte. */
export function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
