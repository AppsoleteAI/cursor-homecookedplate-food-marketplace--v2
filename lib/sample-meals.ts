import { mockMeals } from '@/mocks/data';
import type { Meal } from '@/types';

/** One sample plate leaves the feed for every this many real plates with media. */
export const REAL_MEALS_PER_SAMPLE_REMOVAL = 10;

export function isSampleMealId(id: string): boolean {
  return mockMeals.some((meal) => meal.id === id);
}

export function mealHasUploadedMedia(images: unknown): boolean {
  if (!Array.isArray(images)) return false;
  return images.some((item) => typeof item === 'string' && item.trim().length > 0);
}

export function countMealsWithMedia(meals: { images?: unknown }[]): number {
  return meals.filter((meal) => mealHasUploadedMedia(meal.images)).length;
}

type AreaQuery = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

/**
 * Counts published plates with a photo or video whose cook is locked to this geofence.
 * metro_area is the city boundary when one is stored, and the circular metro when it is not.
 * An unknown area keeps every sample.
 */
export async function countAreaMealsWithMedia(
  supabase: AreaQuery,
  metroArea: string | undefined,
): Promise<number> {
  const area = metroArea?.trim();
  if (!area) return 0;

  const { data: cooks, error: cookError } = await supabase
    .from('profiles')
    .select('id')
    .eq('metro_area', area);
  if (cookError || !cooks?.length) return 0;

  const { data: meals, error: mealError } = await supabase
    .from('meals')
    .select('images')
    .eq('published', true)
    .in('user_id', cooks.map((row: { id: string }) => row.id));
  if (mealError) return 0;
  return countMealsWithMedia(meals || []);
}

/**
 * Samples stay in catalog order. The last sample is removed first.
 * 0–9 real plates keep every sample. 10 real plates remove one.
 */
export function visibleSampleMeals(realMealsWithMedia: number): Meal[] {
  const drop = Math.floor(Math.max(0, realMealsWithMedia) / REAL_MEALS_PER_SAMPLE_REMOVAL);
  const keep = Math.max(0, mockMeals.length - drop);
  return mockMeals.slice(0, keep).map((meal) => ({
    ...meal,
    available: false,
    isSample: true,
  }));
}
