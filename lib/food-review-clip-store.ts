import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FOOD_REVIEW_CLIPS_KEY,
  seedFoodReviewClips,
  type FoodReviewClip,
} from '@/lib/food-review-clips';

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
  return parsed;
}

/** Prepend a clip. The meal video stays on the plate; this is the timeline copy. */
export async function appendFoodReviewClip(clip: FoodReviewClip): Promise<void> {
  const stored = await readFoodReviewClips().catch(() => null);
  const base = stored ?? seedFoodReviewClips;
  const next = [clip, ...base.filter((item) => item.id !== clip.id)];
  await AsyncStorage.setItem(FOOD_REVIEW_CLIPS_KEY, JSON.stringify(next));
}
