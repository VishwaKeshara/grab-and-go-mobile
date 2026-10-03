/**
 * shopService.ts — Shop module service layer
 *
 * ⚠️  IMPORTANT — DATABASE STATUS:
 *     The Supabase tables required by this service
 *     (shops, shop_staff, products, inventory, orders, order_items, pickup_passes)
 *     have NOT yet been confirmed to exist in the live project.
 *     Migration 001 is empty. Migrations 002–004 only create:
 *       profiles, pickup_hubs, notifications.
 *
 *     All functions below are TYPED STUBS. They throw descriptive errors
 *     until the corresponding migration is applied and confirmed.
 *
 *     DO NOT call these functions in production UI until the TODO comment
 *     for each function is resolved.
 *
 *     DO NOT add fake/hardcoded return values here — use local mock
 *     constants inside the screen files for visual development instead.
 */

import { supabase } from "@/lib/supabase";
import type { ShopOrderStatus, ShopOrder } from "@/types/shopOrder";
import type { InventoryItem } from "@/types/product";
import type { ShopDashboardSummary, ShopProfile } from "@/types/shop";

// ─────────────────────────────────────────────────────────────────────────────
// Shop Profile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the shop profile linked to the currently authenticated user.
 *
 * TODO: Implement once migration 005 is applied.
 *
 * Implementation outline:
 *   const { data: userData } = await supabase.auth.getUser();
 *   if (!userData.user) return null;
 *   const { data, error } = await supabase
 *     .from('shops')
 *     .select('*')
 *     .eq('profile_id', userData.user.id)
 *     .single();
 *   if (error) throw error;
 *   return data as ShopProfile;
 *
 * Requires: migration 005 (shops table + RLS: authenticated users can read
 *           their own shop row; is_shop() RLS function).
 */
export async function getShopProfile(): Promise<ShopProfile | null> {
  void supabase; // referenced to prevent unused-import lint warnings
  throw new Error(
    "getShopProfile: `shops` table not confirmed. Apply migration 005 first.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregated order counts and revenue metrics for the shop dashboard.
 *
 * TODO: Implement once migrations 005 & 006 are applied.
 *
 * Implementation outline:
 *   const { count: liveCount } = await supabase
 *     .from('orders')
 *     .select('*', { count: 'exact', head: true })
 *     .eq('shop_id', shopId)
 *     .in('status', ['new', 'accepted', 'packing', 'ready']);
 *   // ... additional queries for packing, ready, completed, revenue
 *
 * Requires: migration 006 (orders, order_items tables).
 */
export async function getShopDashboardSummary(
  shopId: string,
): Promise<ShopDashboardSummary> {
  void shopId;
  throw new Error(
    "getShopDashboardSummary: `orders` table not confirmed. Apply migration 006 first.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the list of orders for a shop, optionally filtered by status.
 *
 * TODO: Implement once migration 006 is applied.
 *
 * Implementation outline:
 *   let query = supabase
 *     .from('orders')
 *     .select('*, profiles!customer_id(full_name, phone)')
 *     .eq('shop_id', shopId)
 *     .order('created_at', { ascending: false });
 *   if (statusFilter?.length) query = query.in('status', statusFilter);
 *   const { data, error } = await query;
 *   if (error) throw error;
 *   return data as ShopOrder[];
 *
 * Requires: migration 006 (orders table + RLS allowing shop to read their orders).
 */
export async function getIncomingOrders(
  shopId: string,
  statusFilter?: ShopOrderStatus[],
): Promise<ShopOrder[]> {
  void shopId;
  void statusFilter;
  throw new Error(
    "getIncomingOrders: `orders` table not confirmed. Apply migration 006 first.",
  );
}

/**
 * Returns full details for a single order, including all order items.
 *
 * TODO: Implement once migration 006 is applied.
 *
 * Implementation outline:
 *   const { data, error } = await supabase
 *     .from('orders')
 *     .select('*, order_items(*, products(name, unit_label)), profiles!customer_id(*)')
 *     .eq('id', orderId)
 *     .single();
 *   if (error) throw error;
 *   return data as ShopOrder;
 *
 * Requires: migration 006 (orders, order_items tables).
 */
export async function getShopOrderById(
  orderId: string,
): Promise<ShopOrder | null> {
  void orderId;
  throw new Error(
    "getShopOrderById: `orders` table not confirmed. Apply migration 006 first.",
  );
}

/**
 * Transitions an order to a new lifecycle status.
 *
 * TODO: Implement once migration 006 is applied.
 *
 * Implementation outline:
 *   const { error } = await supabase
 *     .from('orders')
 *     .update({ status: newStatus, updated_at: new Date().toISOString() })
 *     .eq('id', orderId);
 *   if (error) throw error;
 *
 * Requires: migration 006 + RLS policy allowing shop to UPDATE their own orders.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: ShopOrderStatus,
): Promise<void> {
  void orderId;
  void newStatus;
  throw new Error(
    "updateOrderStatus: `orders` table not confirmed. Apply migration 006 first.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all inventory items for a shop, joined with product details.
 *
 * TODO: Implement once migration 005 is applied.
 *
 * Implementation outline:
 *   const { data, error } = await supabase
 *     .from('inventory')
 *     .select('*, products!product_id(*)')
 *     .eq('products.shop_id', shopId);
 *   if (error) throw error;
 *   return (data ?? []).map(row => ({
 *     ...row,
 *     stockStatus: computeStockStatus(row.quantity, row.low_stock_threshold),
 *   })) as InventoryItem[];
 *
 * Requires: migration 005 (products, inventory tables).
 */
export async function getInventory(shopId: string): Promise<InventoryItem[]> {
  void shopId;
  throw new Error(
    "getInventory: `inventory` table not confirmed. Apply migration 005 first.",
  );
}

/**
 * Updates stock quantity and availability toggle for a product.
 *
 * TODO: Implement once migration 005 is applied.
 *
 * Implementation outline:
 *   const { error: invError } = await supabase
 *     .from('inventory')
 *     .update({ quantity, updated_at: new Date().toISOString() })
 *     .eq('product_id', productId);
 *   const { error: prodError } = await supabase
 *     .from('products')
 *     .update({ is_available: isAvailable })
 *     .eq('id', productId);
 *   if (invError) throw invError;
 *   if (prodError) throw prodError;
 *
 * Requires: migration 005 + RLS allowing shop to UPDATE their own inventory.
 */
export async function updateStock(
  productId: string,
  quantity: number,
  isAvailable: boolean,
): Promise<void> {
  void productId;
  void quantity;
  void isAvailable;
  throw new Error(
    "updateStock: `inventory` table not confirmed. Apply migration 005 first.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Pickup Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a scanned QR token and marks the order as collected.
 *
 * TODO: Implement once migration 006 is applied.
 *
 * Implementation outline:
 *   1. SELECT pickup_passes WHERE qr_token = token AND is_used = false
 *   2. Verify expires_at has not passed
 *   3. UPDATE pickup_passes SET is_used = true WHERE id = pass.id
 *   4. UPDATE orders SET status = 'completed' WHERE id = pass.order_id
 *   5. Return { orderId, customerName } for the confirmation screen
 *
 * Requires: migration 006 (pickup_passes, orders tables).
 */
export async function verifyPickup(
  qrToken: string,
): Promise<{ orderId: string; customerName: string } | null> {
  void qrToken;
  throw new Error(
    "verifyPickup: `pickup_passes` table not confirmed. Apply migration 006 first.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies a staff member's PIN for shop terminal login.
 *
 * TODO: Schema decision required before this can be implemented.
 *
 * Options (discuss with team):
 *   A. Dedicated `shop_staff` table with hashed PIN — verify via
 *      a Supabase Edge Function (never expose hashed PIN to client).
 *   B. Use Supabase Auth with per-staff accounts (email/phone + password),
 *      then verify profile.role === 'shop' after sign-in.
 *   C. Shared shop passcode in the `shops` table (simplest but least secure).
 *
 * ⚠️  NEVER log, store, or transmit the raw PIN. Hash server-side only.
 *
 * @param _staffId  - Human-readable staff identifier (e.g. "KW-07")
 * @param _pin      - 4-digit PIN — must not be logged
 * @param _shopId   - The shop this staff member belongs to
 */
export async function verifyStaffPin(
  _staffId: string,
  _pin: string,
  _shopId: string,
): Promise<boolean> {
  throw new Error(
    "verifyStaffPin: Staff PIN schema not yet defined. See TODO comment for implementation options.",
  );
}
