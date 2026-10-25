import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FOOD_REVIEW_CLIPS_KEY,
  seedFoodReviewClips,
  withSeedClips,
  type FoodReviewClip,
} from '@/lib/food-review-clips';

export const FOOD_REVIEW_BOOKMARKS_KEY = '@food_review_bookmarks_v1';
export const FOOD_REVIEW_HIDDEN_KEY = '@food_review_hidden_v1';
export const FOOD_REVIEW_REPORTS_KEY = '@food_review_reports_v1';

function isStoredClip(value: unknown): value is FoodReviewClip {
  if (!value || typeof value !== 'object') return false;
  const clip = value as FoodReviewClip;
  return typeof clip.id === 'string' && typeof clip.videoUri === 'string' && typeof clip.mealName === 'string';
}

export async function writeFoodReviewClips(clips: FoodReviewClip[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_REVIEW_CLIPS_KEY, JSON.stringify(clips));
}

export async function readFoodReviewClips(): Promise<FoodReviewClip[] | null> {
  const raw = await AsyncStorage.getItem(FOOD_REVIEW_CLIPS_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isStoredClip) || parsed.length === 0) return null;
  return withSeedClips(parsed);
}

export async function readFoodReviewBookmarks(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FOOD_REVIEW_BOOKMARKS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === 'string');
}

export async function writeFoodReviewBookmarks(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_REVIEW_BOOKMARKS_KEY, JSON.stringify(ids));
}

async function readIdList(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === 'string');
}

export async function readHiddenFoodReviewClips(): Promise<string[]> {
  return readIdList(FOOD_REVIEW_HIDDEN_KEY);
}

export async function writeHiddenFoodReviewClips(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_REVIEW_HIDDEN_KEY, JSON.stringify(ids));
}

export async function readFoodReviewReports(): Promise<string[]> {
  return readIdList(FOOD_REVIEW_REPORTS_KEY);
}

export async function writeFoodReviewReports(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_REVIEW_REPORTS_KEY, JSON.stringify(ids));
}

/** Prepend a clip. The meal video stays on the plate; this is the timeline copy. */
export async function appendFoodReviewClip(clip: FoodReviewClip): Promise<void> {
  const stored = await readFoodReviewClips().catch(() => null);
  const base = stored ?? seedFoodReviewClips;
  const next = [clip, ...base.filter((item) => item.id !== clip.id)];
  await AsyncStorage.setItem(FOOD_REVIEW_CLIPS_KEY, JSON.stringify(next));
}
