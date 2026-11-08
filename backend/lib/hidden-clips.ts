import { missingColumn } from './content-moderation';

type Admin = { from: (table: string) => any };

/** Video addresses a report or an admin removal is holding off the timeline. */
export async function hiddenClipVideoAddresses(admin: { from: (table: string) => any }): Promise<Set<string>> {
  const listed = await admin.from('food_review_clips').select('video_url').eq('hidden', true).limit(200);
  if (listed.error) return new Set();
  const urls = (listed.data || [])
    .map((row: { video_url?: string }) => row.video_url)
    .filter((url: string | undefined): url is string => typeof url === 'string' && url.length > 0);
  return new Set(urls);
}

export function withoutHiddenVideos(images: string[] | null | undefined, hidden: Set<string>): string[] {
  return (images || []).filter((uri) => !hidden.has(uri));
}

export function mealImageReportId(mealId: string, imageUrl: string): string {
  return `${mealId}|${imageUrl}`;
}

export function parseMealImageReport(targetId: string): { mealId: string; imageUrl: string } | null {
  const split = targetId.indexOf('|');
  if (split <= 0) return null;
  const mealId = targetId.slice(0, split);
  const imageUrl = targetId.slice(split + 1);
  if (!mealId || !imageUrl.startsWith('https://')) return null;
  return { mealId, imageUrl };
}

export function visiblePlateMedia(
  images: string[] | null | undefined,
  hiddenStills: string[] | null | undefined,
  hiddenVideos: Set<string>,
): string[] {
  const held = new Set(hiddenStills || []);
  return (images || []).filter((uri) => Boolean(uri) && !held.has(uri) && !hiddenVideos.has(uri));
}

export async function setMealImageHeld(
  admin: Admin,
  mealId: string,
  imageUrl: string,
  held: boolean,
): Promise<boolean> {
  const row = await admin.from('meals').select('id, hidden_images').eq('id', mealId).maybeSingle();
  if (row.error && missingColumn(row.error.message, 'hidden_images')) return false;
  if (!row.data) return false;
  const current = Array.isArray(row.data.hidden_images)
    ? row.data.hidden_images.filter((uri: unknown): uri is string => typeof uri === 'string')
    : [];
  const next = held ? [...new Set([...current, imageUrl])] : current.filter((uri: string) => uri !== imageUrl);
  const saved = await admin.from('meals').update({ hidden_images: next }).eq('id', mealId);
  if (saved.error && missingColumn(saved.error.message, 'hidden_images')) return false;
  return !saved.error;
}

export async function setProfileImageHeld(admin: Admin, userId: string, held: boolean): Promise<boolean> {
  const saved = await admin.from('profiles').update({ profile_image_hidden: held }).eq('id', userId);
  if (saved.error && missingColumn(saved.error.message, 'profile_image_hidden')) return false;
  return !saved.error;
}

/** Reported food photos, keyed by plate. An empty map means the column is not on this kitchen yet. */
export async function hiddenMealImages(admin: Admin, mealIds: string[]): Promise<Map<string, string[]>> {
  const unique = [...new Set(mealIds.filter(Boolean))];
  const hidden = new Map<string, string[]>();
  if (unique.length === 0) return hidden;
  const listed = await admin.from('meals').select('id, hidden_images').in('id', unique);
  if (listed.error && missingColumn(listed.error.message, 'hidden_images')) return hidden;
  if (listed.error) return hidden;
  for (const row of listed.data || []) {
    hidden.set(row.id, Array.isArray(row.hidden_images) ? row.hidden_images.filter((uri: unknown) => typeof uri === 'string') : []);
  }
  return hidden;
}
