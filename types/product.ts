/**
 * Product and inventory TypeScript types for the shop module.
 *
 * Maps to the following Supabase tables (applied in migrations 005 + 006):
 *   customer_products — product catalog (migration 005)
 *   shop_inventory    — per-shop stock quantities (migration 006)
 *
 * @see services/shopService.ts → getInventory(), updateStock()
 * @see supabase/migrations/005_customer_ordering.sql
 * @see supabase/migrations/006_shop_operations.sql
 */

// ─────────────────────────────────────────────────────────────
// StockStatus (computed client-side)
// ─────────────────────────────────────────────────────────────

/**
 * Derived client-side from shop_inventory.quantity vs
 * shop_inventory.low_stock_threshold. Never stored in the database.
 */
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

// ─────────────────────────────────────────────────────────────
// Product
// Maps to: public.customer_products (migration 005)
// ─────────────────────────────────────────────────────────────

/**
 * A product listed by a shop in the customer catalog.
 *
 * Column mapping:
 *   id             → customer_products.id
 *   shopId         → customer_products.shop_id
 *   name           → customer_products.name
 *   unit           → customer_products.unit        (e.g. "500 g", "1 L")
 *   priceLkr       → customer_products.price_lkr
 *   regularPriceLkr → customer_products.regular_price_lkr
 *   imageUrl       → customer_products.image_url
 *   active         → customer_products.active
 *
 * Note: `description` and `category` are NOT columns in customer_products.
 * They were removed to match the confirmed migration 005 schema.
 */
export interface InventoryProduct {
  id: string;
  shopId: string;
  name: string;
  /** Human-readable unit label, e.g. "500 g", "1 L", "pack of 6". */
  unit: string;
  /** Current price in LKR (integer). */
  priceLkr: number;
  /** Pre-discount price in LKR (integer). Used to calculate savings. */
  regularPriceLkr: number;
  imageUrl: string | null;
  /** Platform-level active flag — product is listed in the catalog. */
  active: boolean;
}

// ─────────────────────────────────────────────────────────────
// InventoryItem
// Maps to: public.shop_inventory JOIN public.customer_products (006 + 005)
// ─────────────────────────────────────────────────────────────

/**
 * A single inventory row joined with its product details.
 * Returned by shopService.getInventory(shopId).
 *
 * Column mapping:
 *   id                → shop_inventory.id
 *   shopId            → shop_inventory.shop_id
 *   productId         → shop_inventory.product_id
 *   quantity          → shop_inventory.quantity
 *   lowStockThreshold → shop_inventory.low_stock_threshold
 *   isAvailable       → shop_inventory.is_available
 *   updatedAt         → shop_inventory.updated_at
 *   product           → joined from customer_products (not a column)
 *   stockStatus       → computed client-side (not stored)
 */
export interface InventoryItem {
  id: string;
  shopId: string;
  productId: string;
  /** Populated via JOIN with products table. */
  product: InventoryProduct;
  quantity: number;
  lowStockThreshold: number;
  /** Per-shop availability toggle (distinct from customer_products.active). */
  isAvailable: boolean;
  updatedAt: string;
  /** Computed client-side — not stored in the database. */
  stockStatus: StockStatus;
}
/**
 * Which of the two discount options a shop picked.
 *
 *   "percent" → discount_percent is the applied value, 0-100
 *   "fixed"   → discount_amount_lkr is the applied value, whole rupees off
 *
 * Only one option is ever stored on a row. null means no discount.
 * Added by migration 021; see supabase/migrations/021_product_fixed_discount.sql.
 */
export type DiscountType = "percent" | "fixed";

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  /**
   * Free-text category label, e.g. "Vegetables". Null when uncategorised.
   *
   * This replaced a category_id foreign key into a product_categories table in
   * migration 024. It is plain text the shop types, not a reference, so matching
   * on it is always case-insensitive.
   */
  category: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  is_available: boolean;
  active?: boolean;
  regular_price?: number;
  /** Discount applied, 0-100. Added by migration 019. */
  discount_percent?: number | null;
  /** Which discount option is stored. Added by migration 021. */
  discount_type?: DiscountType | null;
  /** Whole rupees off, used only when discount_type is "fixed". Migration 021. */
  discount_amount_lkr?: number | null;
  created_at: string;
  updated_at: string;
};

/** A product joined with the minimal shop fields the UI needs to render. */
export type ProductWithShop = Product & {
  shop_name: string;
};

export type ProductInput = {
  shop_id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  price: number;
  stock_quantity?: number;
  image_url?: string | null;
  is_available?: boolean;
};

export type ProductUpdate = Partial<Omit<ProductInput, "shop_id">>;

export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  author_name?: string | null;
};

export type ProductFilters = {
  query?: string;
  category?: string;
  shopId?: string;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: ProductSort;
  /**
   * Only listings running a discount. Drives the Offers filter.
   * @see utils/discounts.ts
   */
  offersOnly?: boolean;
};

export type ProductSort = "relevance" | "price_asc" | "price_desc" | "name";

export type SearchHistoryEntry = {
  id: string;
  user_id: string;
  query: string;
  result_count: number;
  created_at: string;
};
