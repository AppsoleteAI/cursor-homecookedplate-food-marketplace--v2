/**
 * Columns returned by the public plate list, the plate page, and the review list.
 * The Worker talks to Supabase over HTTPS. It does not open a Postgres connection,
 * so these reads do not use the pooler host or a per-isolate connection limit.
 */

export const PUBLIC_MEAL_COLUMNS = [
  "id",
  "user_id",
  "name",
  "description",
  "price",
  "images",
  "ingredients",
  "cuisine",
  "category",
  "dietary_options",
  "preparation_time",
  "available",
  "published",
  "rating",
  "review_count",
  "featured",
  "tags",
  "created_at",
].join(",");

export const PUBLIC_MEAL_PAGE_COLUMNS = `${PUBLIC_MEAL_COLUMNS},expiry_date,receipt_date`;

export const PUBLIC_REVIEW_COLUMNS = [
  "id",
  "meal_id",
  "order_id",
  "author_id",
  "rating",
  "created_at",
].join(",");

/** Comment text is read with the service role, then shown only when a moderator has allowed it. */
export const REVIEW_COMMENT_COLUMNS = "id, comment, comment_status";

export function mealListSelect(withCookMetro: boolean): string {
  if (!withCookMetro) return PUBLIC_MEAL_COLUMNS;
  return `${PUBLIC_MEAL_COLUMNS},cook:profiles!meals_user_id_fkey!inner(metro_area)`;
}
