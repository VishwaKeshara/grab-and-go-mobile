import { supabase } from "@/lib/supabase";
import { productWriteAccess } from "@/services/productService";
import type { CheapestElsewhere, StockItem } from "@/types/stockUpdate";

/**
 * Data layer for the Stock Update screen.
 *
 * Reads are product-centric (one row per customer_products entry) because the
 * screen has to manage every catalogue item, including products the shop has
 * never recorded stock for. shop_inventory is therefore LEFT JOINED rather than
 * inner joined -- an inner join would hide every product the moment that table
 * is empty, which is exactly the state it is in now.
 */

const ITEM_COLUMNS = `
  id, shop_id, name, unit, price_lkr, regular_price_lkr, image_url,
  active, available, stock_quantity, category,
  shop_inventory(quantity, low_stock_threshold, is_available, updated_at)
`;

/** PostgREST returns an embedded to-one as an object, but widening differs by version. */
function one(value: unknown): Record<string, unknown> | null {
    if (Array.isArray(value)) {
        return (value[0] as Record<string, unknown> | undefined) ?? null;
    }
    if (value && typeof value === "object") return value as Record<string, unknown>;
    return null;
}

/**
 * Every active product for a shop, joined with its stock row and category.
 * Ordered by name so the list is stable between loads.
 */
export async function listStockItems(shopId: string): Promise<StockItem[]> {
    const { data, error } = await supabase
        .from("customer_products")
        .select(ITEM_COLUMNS)
        .eq("shop_id", shopId)
        .eq("active", true)
        .order("name", { ascending: true });

    if (error) throw error;

    return ((data as unknown as Record<string, unknown>[]) ?? []).map((row) => {
        const inventory = one(row.shop_inventory);

        return {
            id: row.id as string,
            shopId: row.shop_id as string,
            name: (row.name as string) ?? "Unnamed product",
            unit: (row.unit as string) ?? "",
            priceLkr: Number(row.price_lkr ?? 0),
            regularPriceLkr: Number(row.regular_price_lkr ?? 0),
            imageUrl: (row.image_url as string | null) ?? null,
            active: row.active !== false,
            // Prefer the inventory row, fall back to the copy on the product so
            // an unstocked product still shows its real level instead of 0.
            quantity: inventory
                ? Number(inventory.quantity ?? 0)
                : Number(row.stock_quantity ?? 0),
            lowStockThreshold: inventory
                ? Number(inventory.low_stock_threshold ?? 5)
                : 5,
            isAvailable: inventory
                ? inventory.is_available !== false
                : row.available !== false,
            updatedAt: (inventory?.updated_at as string | null) ?? null,
            hasInventoryRow: inventory !== null,
            categoryName: (row.category as string | null)?.trim() || null,
        };
    });
}

/**
 * Cheapest price per product name across every other active shop.
 *
 * Powers the "Lowest in <hub>" line on each card. Grouped by name because
 * customer_products has no shared product identity between shops -- matching
 * on name is the only signal available without a catalogue-linking table.
 */
export async function listCheapestElsewhere(
    shopId: string,
): Promise<Record<string, CheapestElsewhere>> {
    const { data, error } = await supabase
        .from("customer_products")
        .select("shop_id, name, price_lkr, customer_shops!inner(name)")
        .eq("active", true)
        .eq("customer_shops.active", true);

    if (error) throw error;

    const best: Record<string, CheapestElsewhere> = {};

    for (const row of (data as unknown as Record<string, unknown>[]) ?? []) {
        const shop = one(row.customer_shops);
        if (!shop) continue;
        if (row.shop_id === shopId) continue;

        const name = (row.name as string) ?? "";
        const priceLkr = Number(row.price_lkr ?? 0);
        const shopName = (shop.name as string) ?? "";

        const current = best[name];
        if (!current || priceLkr < current.priceLkr) {
            best[name] = { shopName, priceLkr };
        }
    }

    return best;
}

/**
 * Writes a stock change for one product.
 *
 * Two paths, because there are two ways to run a shop. Staff hold a PIN token
 * and have no Supabase session, so their request runs as `anon` and goes
 * through staff_set_product_stock, which is SECURITY DEFINER, validates the
 * token, derives the shop from it and refuses products belonging to another
 * shop. The owner has a session, so their request runs as `authenticated` and
 * the two statements are written directly, which 022 grants and scopes to
 * their own shop.
 *
 * Both paths update shop_inventory and customer_products together so the
 * denormalised stock_quantity never drifts.
 *
 * See migrations/018_staff_product_writes.sql and 022_owner_shop_writes.sql.
 */
export async function saveStock(input: {
    shopId: string;
    productId: string;
    quantity: number;
    isAvailable: boolean;
}): Promise<void> {
    const quantity = Math.max(0, Math.trunc(input.quantity));
    const access = await productWriteAccess();

    if (access.kind === "owner") {
        // staff_set_product_stock upserts shop_inventory and then mirrors the
        // result into customer_products.stock_quantity / .available. Both
        // statements are reproduced rather than approximated, because
        // customer-facing search reads stock_quantity directly and the two
        // copies drifting apart is what makes a product look sold out while it
        // has stock.
        const { data: existing, error: lookupError } = await supabase
            .from("shop_inventory")
            .select("id")
            .eq("shop_id", input.shopId)
            .eq("product_id", input.productId)
            .limit(1);

        if (lookupError) throw lookupError;

        const inventoryRow = (existing ?? [])[0] as { id?: string } | undefined;

        const payload = {
            quantity,
            is_available: input.isAvailable,
            updated_at: new Date().toISOString(),
        };

        const { error: writeError } = inventoryRow
            ? await supabase.from("shop_inventory").update(payload).eq("id", inventoryRow.id)
            : await supabase.from("shop_inventory").insert({
                shop_id: input.shopId,
                product_id: input.productId,
                quantity,
                low_stock_threshold: 5,
                is_available: input.isAvailable,
                updated_at: payload.updated_at,
            });

        if (writeError) throw writeError;

        const { error: productError } = await supabase
            .from("customer_products")
            .update({ stock_quantity: quantity, available: input.isAvailable })
            .eq("id", input.productId);

        if (productError) throw productError;
        return;
    }

    const { error } = await supabase.rpc("staff_set_product_stock", {
        p_token: access.token,
        p_product_id: input.productId,
        p_quantity: quantity,
        p_is_available: input.isAvailable,
    });

    if (error) throw error;
}
