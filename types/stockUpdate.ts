/**
 * Shapes for the Stock Update screen (Member 2).
 *
 * The screen is product-centric: one card per row in customer_products, which
 * is the catalogue the customer searches. Stock lives in shop_inventory, which
 * is a separate table that only has a row once a shop has stocked a product.
 * Because those rows do not all exist yet, every stock field here is a resolved
 * value that falls back to the denormalised copy on customer_products rather
 * than assuming an inventory row is present.
 */

/** How a product's stock level reads on the card. */
export type StockStatus = "in" | "low" | "out";

export type StockItem = {
    /** customer_products.id */
    id: string;
    shopId: string;
    name: string;
    /** Pack size, e.g. "5kg", "1L", "200g". */
    unit: string;
    priceLkr: number;
    regularPriceLkr: number;
    imageUrl: string | null;
    /** customer_products.active — a deactivated product leaves search entirely. */
    active: boolean;
    /**
     * Resolved quantity. shop_inventory.quantity when an inventory row exists,
     * otherwise customer_products.stock_quantity.
     */
    quantity: number;
    /** Resolved threshold, defaulting to 5 when no inventory row exists. */
    lowStockThreshold: number;
    /** Resolved availability flag. */
    isAvailable: boolean;
    /** shop_inventory.updated_at, or null when the product has no inventory row. */
    updatedAt: string | null;
    /** Whether an inventory row backs this item. False means writes must insert. */
    hasInventoryRow: boolean;
    /** Category label from product_categories, or null when uncategorised. */
    categoryName: string | null;
};

/** Cheapest offer for the same product name at another active shop. */
export type CheapestElsewhere = {
    shopName: string;
    priceLkr: number;
};

/** Filter chips across the top of the screen. */
export type StockFilter =
    | { kind: "all" }
    | { kind: "low" }
    | { kind: "out" }
    | { kind: "category"; value: string };

export function stockStatusOf(item: StockItem): StockStatus {
    if (item.quantity <= 0) return "out";
    if (item.quantity < item.lowStockThreshold) return "low";
    return "in";
}
