import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const file = resolve(root, "backend/sql/add_query_indexes.sql");
const sql = readFileSync(file, "utf8");

const names = [
  "idx_meals_menu_created",
  "idx_meals_menu_cuisine",
  "idx_meals_menu_category",
  "idx_meals_cook_menu",
  "idx_reviews_meal_created",
  "idx_reviews_author_created",
  "idx_notifications_user_created",
  "idx_promotional_offers_active_meal",
  "idx_reviews_pending",
  "idx_orders_buyer_created",
  "idx_orders_cook_paid_created",
  "idx_orders_cook_created",
];

describe("query indexes", () => {
  it("adds the missing composite and partial indexes and leaves existing ones alone", () => {
    for (const name of names) {
      expect(sql).toContain(name);
    }
    expect(sql).toContain("where published = true and available = true");
    expect(sql).toContain("where is_active = true");
    expect(sql).toContain("where comment_status = 'pending'");
    expect(sql).toContain("where paid = true");
    expect(sql).toContain("buyer_id");
    expect(sql).toContain("platetaker_id");
    expect(sql).toContain("seller_id");
    expect(sql).toContain("platemaker_id");
    expect(sql).not.toContain("idx_profiles_metro_area");
    expect(sql).not.toContain("idx_transactions_created_at");
    expect(sql).not.toContain("idx_metro_geofences_is_active");

    const others = readdirSync(resolve(root, "backend/sql"))
      .filter((entry) => entry.endsWith(".sql") && entry !== "add_query_indexes.sql");
    const existing = others.map((entry) => readFileSync(resolve(root, "backend/sql", entry), "utf8")).join("\n");
    for (const name of names) {
      expect(existing).not.toContain(name);
    }
  });
});
