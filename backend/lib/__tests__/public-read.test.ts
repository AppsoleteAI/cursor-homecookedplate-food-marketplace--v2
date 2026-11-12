import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  mealListSelect,
  PUBLIC_MEAL_COLUMNS,
  PUBLIC_MEAL_PAGE_COLUMNS,
  PUBLIC_REVIEW_COLUMNS,
} from "../public-read";

const root = resolve(__dirname, "../../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("public read columns", () => {
  it("names the plate and review columns and leaves out a star", () => {
    expect(PUBLIC_MEAL_COLUMNS.split(",")).toEqual([
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
    ]);
    expect(PUBLIC_MEAL_PAGE_COLUMNS.startsWith(PUBLIC_MEAL_COLUMNS)).toBe(true);
    expect(PUBLIC_MEAL_PAGE_COLUMNS).toContain("expiry_date");
    expect(PUBLIC_MEAL_PAGE_COLUMNS).toContain("receipt_date");
    expect(PUBLIC_REVIEW_COLUMNS).not.toContain("comment");
    expect(PUBLIC_REVIEW_COLUMNS).not.toContain("comment_status");
    expect(mealListSelect(false)).toBe(PUBLIC_MEAL_COLUMNS);
    expect(mealListSelect(true)).toContain("cook:profiles!meals_user_id_fkey!inner(metro_area)");
    for (const columns of [PUBLIC_MEAL_COLUMNS, PUBLIC_MEAL_PAGE_COLUMNS, PUBLIC_REVIEW_COLUMNS, mealListSelect(true)]) {
      expect(columns).not.toContain("*");
    }
  });

  it("uses those columns on the plate list, the plate page, and the review list", () => {
    const list = source("backend/trpc/routes/meals/list/route.ts");
    const page = source("backend/trpc/routes/meals/get/route.ts");
    const reviews = source("backend/trpc/routes/reviews/list/route.ts");
    expect(list).toContain("mealListSelect");
    expect(list).toContain("PUBLIC_MEAL_COLUMNS");
    expect(list).not.toContain(".select('*')");
    expect(list).not.toContain(".select(\"*\")");
    expect(page).toContain("PUBLIC_MEAL_PAGE_COLUMNS");
    expect(page).not.toContain(".select('*')");
    expect(reviews).toContain("PUBLIC_REVIEW_COLUMNS");
    expect(reviews).not.toContain(".select('*')");
  });
});
