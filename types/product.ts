/**
 * Product and inventory TypeScript types for the shop module.
 *
 * ⚠️  DATABASE STATUS: No Supabase schema has been confirmed yet.
 *     Coordinate with PramudithaJayasena-product-shop on the final `products`
 *     and `inventory` table definitions before writing migrations.
 *
 * TODO (migration 005): maps to `products` and `inventory` tables.
 */

/**
 * Computed stock availability level — derived client-side from
 * InventoryItem.quantity vs InventoryItem.lowStockThreshold.
 * Not stored in the database.
 */
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/**
 * A product listed by a shop, available for customer purchase.
 *
 * TODO: maps to the `products` table.
 */
export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  /** Price in LKR. */
  price: number;
  /** Human-readable price unit label, e.g. "per 500g", "each", "per kg". */
  unitLabel: string;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt: string;
}

/**
 * Inventory record for a product, combining stock quantity with the product details.
 *
 * TODO: maps to the `inventory` table joined with `products`.
 *       The `product` field is populated via a JOIN — it is not a column in `inventory`.
 */
export interface InventoryItem {
  id: string;
  productId: string;
  /** Populated via JOIN with products table. */
  product: Product;
  quantity: number;
  lowStockThreshold: number;
  /** Computed client-side: out_of_stock if qty=0, low_stock if qty <= threshold. */
  stockStatus: StockStatus;
  updatedAt: string;
}
