import { evaluateKitchenPermit } from '@/lib/kitchen-permit';
import { countMealsWithMedia } from '@/lib/sample-meals';

type Admin = { from: (table: string) => any };

export async function cookPermitIsSaved(admin: Admin, userId: string): Promise<boolean> {
  const row = await admin.from('profiles').select('kitchen_permit').eq('id', userId).maybeSingle();
  if (row.error) return false;
  return evaluateKitchenPermit(row.data?.kitchen_permit).ok;
}

export async function permittedCookIds(admin: Admin, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const rows = await admin.from('profiles').select('id, kitchen_permit').in('id', unique);
  if (rows.error) return new Set();
  const allowed = new Set<string>();
  for (const row of rows.data || []) {
    if (evaluateKitchenPermit(row.kitchen_permit).ok) allowed.add(row.id);
  }
  return allowed;
}

/** Published plates with a photo, only from cooks whose home-kitchen agreement is saved. */
export async function countPermittedMealsWithMedia(admin: Admin, metroArea: string | undefined): Promise<number> {
  const area = metroArea?.trim();
  if (!area) return 0;
  const cooks = await admin.from('profiles').select('id, kitchen_permit').eq('metro_area', area);
  if (cooks.error || !cooks.data?.length) return 0;
  const ids = (cooks.data as { id: string; kitchen_permit: unknown }[])
    .filter((row) => evaluateKitchenPermit(row.kitchen_permit).ok)
    .map((row) => row.id);
  if (ids.length === 0) return 0;
  const meals = await admin.from('meals').select('images').eq('published', true).in('user_id', ids);
  if (meals.error) return 0;
  return countMealsWithMedia(meals.data || []);
}
