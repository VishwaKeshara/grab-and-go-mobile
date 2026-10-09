import type { DiscountType } from "@/types/product";

/**
 * Customer-facing browse shapes.
 *
 * Everything the home screen, the nearby-shops screen and the search screen show
 * comes from `services/discoveryService.ts`. These are deliberately separate
 * from the `Product` type, which mirrors the legacy `products` table and declares
 * columns (description, created_at, updated_at) that customer_products does not
 * have.
 */

/** One product as the customer browse screens need it. */
export type DiscoveredProduct = {
  id: string;
  shop_id: string;
  shop_name: string;
  name: string;
  unit: string;
  /** Current, already-discounted price in LKR. */
  price: number;
  /** Pre-discount price in LKR. Equals `price` when no discount is running. */
  regular_price: number;
  image_url: string | null;
  /** From shop_inventory, falling back to the copy on customer_products. */
  stock_quantity: number;
  is_available: boolean;
  /**
   * Free-text category the shop picked when it added the listing, e.g.
   * "Vegetables". Was a uuid foreign key until migration 023, which dropped the
   * product_categories table in favour of storing the label directly.
   */
  category: string | null;
  discount_percent: number | null;
  discount_type: DiscountType | null;
  discount_amount_lkr: number | null;
};

/** A shop in the nearby list. */
export type NearbyShop = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  pickup_counter: string;
  preparation_minutes: number;
  is_open: boolean;
  /** Active, in-stock listings, so the list can say "24 items" without a 2nd trip. */
  productCount: number;
  /** How many of those listings are on offer. */
  offerCount: number;
  /** True when the shop sits in the customer's preferred pickup hub. */
  isPreferredHub: boolean;
};

/**
 * One category for the home rail.
 *
 * Derived from the distinct customer_products.category values rather than a
 * reference table, so the label IS the id: it is what the rail routes with and
 * what the product list filters on. Icon and tint come from
 * utils/categories.ts, which keys them off the name.
 */
export type BrowseCategory = {
  /** The stored label, used both as display text and as the filter value. */
  name: string;
  icon: string;
  tint: string;
  /** Active listings in this category. 0 categories are dropped from the rail. */
  productCount: number;
};