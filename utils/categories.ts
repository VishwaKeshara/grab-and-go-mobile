// Type-only, deliberately. The icon names below are plain strings; nothing here
// reads a glyph map at runtime, and a value import would drag the whole icon set
// into every consumer -- including tests/node, which cannot resolve it.
import type { FontAwesome } from "@expo/vector-icons";

/**
 * Presentation for the free-text category on customer_products.
 *
 * Migration 024 replaced customer_products.category_id -- a uuid foreign key into
 * a product_categories reference table -- with customer_products.category, a
 * plain text label the shop types when it adds a listing ("Vegetables",
 * "Fruits"). There is no table behind it any more, so the two things the rail
 * used to read from there, an icon and a tint, are derived here instead.
 *
 * Both helpers key off the lower-cased name, so "Vegetables" and "vegetables"
 * render identically. That matters more than usual: nothing normalises the
 * stored text, so two shops picking different capitalisation would otherwise
 * produce two visually different tiles for the same shelf.
 */

/**
 * The categories offered on a fresh catalogue, before any shop has typed one.
 *
 * The Add Product form's chips come from the labels already in
 * customer_products.category, which is the honest list -- but on an empty
 * database that list is empty, and a form with nothing to pick from is not a
 * picker. These are the seeds: the usual grocery aisles, so the shop can select
 * a category immediately instead of having to know to spell it correctly.
 *
 * Suggestions, not a whitelist. Anything else typed is accepted and saved, and
 * anything typed joins the chips for everyone afterwards. This list only fills
 * the gap before the first product exists.
 */
export const SUGGESTED_CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Dairy",
  "Bakery",
  "Rice & Grains",
  "Meat & Fish",
  "Beverages",
  "Snacks",
  "Household",
  "Personal Care",
] as const;

/**
 * Backgrounds for a category tile.
 *
 * Muted enough to sit behind a dark icon at the size the home rail draws them.
 * Ordered, and picked by a stable hash of the name, so a category keeps the same
 * colour between launches.
 */
const TINTS = [
  "#DFF3E6",
  "#FFF0D5",
  "#E8ECFF",
  "#FFE6E0",
  "#E7E1FB",
  "#DDF1F5",
  "#F6E7D2",
  "#E9F0DC",
];

/** Deterministic string hash. Same name in, same colour out, every launch. */
function hash(value: string): number {
  let total = 0;

  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }

  return total;
}

/** Tile background for a category name. */
export function categoryTint(name: string): string {
  const key = name.trim().toLowerCase();
  return TINTS[hash(key) % TINTS.length];
}

/**
 * Maps a category name onto a FontAwesome icon.
 *
 * The home rail used to store `icon` on the product_categories row. The name is
 * the only signal left, so it is keyword-matched against it. Names that match
 * nothing fall back to the basket, which is also what an uncategorised listing
 * shows -- never a missing-glyph box.
 */
export function categoryIcon(
  name: string,
): React.ComponentProps<typeof FontAwesome>["name"] {
  const key = name.trim().toLowerCase();

  const byKeyword: [string[], React.ComponentProps<typeof FontAwesome>["name"]][] = [
    [["vegetable", "veggie", "salad", "greens"], "leaf"],
    [["fruit", "apple", "banana", "mango", "citrus", "orange"], "lemon-o"],
    [["dairy", "milk", "cheese", "yoghurt", "yogurt", "egg"], "glass"],
    [["bakery", "bread", "cake", "pastry"], "birthday-cake"],
    [["meat", "chicken", "beef", "pork", "fish", "seafood"], "cutlery"],
    [["frozen", "ice"], "snowflake-o"],
    [["beverage", "drink", "juice", "tea", "coffee"], "coffee"],
    [["snack", "biscuit", "chip", "candy", "chocolate"], "gift"],
    [["household", "cleaning", "detergent", "tissue", "toilet"], "home"],
    [["personal care", "shampoo", "soap", "toothpaste", "beauty"], "heart"],
    [["baby", "infant"], "child"],
    [["car", "auto", "vehicle"], "car"],
    [["pet", "animal"], "paw"],
    [["electronic", "gadget", "phone"], "bolt"],
  ];

  for (const [keywords, icon] of byKeyword) {
    if (keywords.some((keyword) => key.includes(keyword))) return icon;
  }

  return "shopping-basket";
}