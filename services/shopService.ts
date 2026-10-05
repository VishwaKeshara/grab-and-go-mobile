/**
 * shopService.ts — Shop Operations & Administration service layer
 *
 * Member 4 — Reads from and writes to the shared customer_* tables
 * defined in migration 005 and extended in migration 006.
 *
 * DATABASE PREREQUISITE:
 *   Apply migrations in order:
 *     1. supabase/migrations/005_customer_ordering.sql
 *     2. supabase/migrations/006_shop_operations.sql
 *
 * TABLE MAPPING (no bare-name tables — all shared with customer side):
 *   customer_shops         → shop identity + owner link
 *   customer_products      → product catalog (read-only here)
 *   customer_orders        → order queue; shop can READ + UPDATE status
 *   customer_order_items   → line items; shop can READ + UPDATE is_packed
 *   shop_staff             → staff members (006)
 *   shop_inventory         → per-shop stock quantities (006)
 *   pickup_verifications   → handover event log (006)
 *   security_events        → admin monitoring feed (006)
 *
 * RPC FUNCTIONS (defined in migration 006):
 *   verify_staff_pin(staff_code, pin_plain, shop_id) → jsonb
 *   get_shop_dashboard_summary(shop_id)              → jsonb
 *
 * SECURITY:
 *   - PIN hashes are NEVER returned to the client; verified via RPC only.
 *   - All shop writes are guarded by is_shop_owner(shop_id) RLS.
 *   - Admin writes are guarded by is_admin() RLS.
 *   - Do NOT expose service-role keys in client code.
 *
 * DO NOT MODIFY:
 *   services/orderService.ts, services/cartService.ts,
 *   services/productService.ts — Member 2 / 3 files.
 */

import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/services/productService";
import type {
  ShopOrderStatus,
  ShopOrder,
  ShopOrderItem,
  PickupVerification,
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
} from "@/types/shopOrder";
import type { InventoryItem } from "@/types/product";
import type {
  Shop,
  ShopInput,
  ShopUpdate,
  ShopDashboardSummary,
  ShopProfile,
  StaffLoginResult,
} from "@/types/shop";

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Computes SLA timestamp fields to include when updating order status.
 * Only sets a timestamp once (null-guarded on the DB side via the trigger).
 */
function slaTimestampFor(status: ShopOrderStatus): Record<string, string | null> {
  const now = new Date().toISOString();
  switch (status) {
    case "accepted": return { accepted_at: now };
    case "packing":  return { packing_started_at: now };
    case "ready":    return { ready_at: now };
    default:         return {};
  }
}

// ─────────────────────────────────────────────────────────────
// Shop Profile
// ─────────────────────────────────────────────────────────────

/**
 * Returns the shop profile linked to the given profile ID.
 * Called after the shop owner signs in via Supabase Auth.
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: is_shop_owner() or is_admin().
 *
 * @param profileId - auth.users id of the signed-in shop owner.
 */
export async function getShopByProfileId(
  profileId: string,
): Promise<ShopProfile | null> {
  const { data, error } = await supabase
    .from("customer_shops")
    .select(
      "id, profile_id, hub_id, name, address, phone, pickup_counter, " +
      "preparation_minutes, active, is_open, opened_at",
    )
    .eq("profile_id", profileId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  return {
    id:            row.id as string,
    profileId:     (row.profile_id as string | null) ?? null,
    hubId:         (row.hub_id as string | null) ?? null,
    name:          row.name as string,
    address:       row.address as string,
    phone:         (row.phone as string | null) ?? null,
    pickupCounter: row.pickup_counter as string,
    prepMinutes:   row.preparation_minutes as number,
    active:        row.active as boolean,
    isOpen:        row.is_open as boolean,
    openedAt:      (row.opened_at as string | null) ?? null,
  } satisfies ShopProfile;
}

/**
 * @deprecated Use getShopByProfileId() instead.
 * Kept for backward compatibility during refactor.
 */
export async function getShopProfile(): Promise<ShopProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  return getShopByProfileId(userData.user.id);
}

// ─────────────────────────────────────────────────────────────
// Staff Authentication
// ─────────────────────────────────────────────────────────────

/**
 * Verifies a staff PIN via the verify_staff_pin() Supabase RPC.
 *
 * The RPC runs with SECURITY DEFINER — pin_hash is compared
 * server-side and is NEVER sent to the client. Failed attempts
 * are automatically logged to security_events by the RPC.
 *
 * Requires: migration 006 applied.
 *
 * @param staffCode - Human-readable staff ID, e.g. "KW-07".
 * @param pin       - Raw 4-digit PIN (sent over TLS; never stored).
 * @param shopId    - UUID of the shop this staff member belongs to.
 * @returns StaffLoginResult on success, or null on invalid credentials.
 */
export async function verifyStaffPin(
  staffCode: string,
  pin: string,
  shopId: string,
): Promise<StaffLoginResult | null> {
  const { data, error } = await supabase.rpc("verify_staff_pin", {
    p_staff_code: staffCode,
    p_pin_plain:  pin,
    p_shop_id:    shopId,
  });

  if (error) throw error;

  const result = data as {
    success: boolean;
    reason?: string;
    staff_id?: string;
    staff_code?: string;
    full_name?: string;
    role?: string;
    shift?: string;
  };

  if (!result.success) return null;

  return {
    success:   true,
    staffId:   result.staff_id!,
    staffCode: result.staff_code!,
    fullName:  result.full_name!,
    role:      result.role as StaffLoginResult["role"],
    shift:     result.shift as StaffLoginResult["shift"],
  } satisfies StaffLoginResult;
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

/**
 * Returns aggregated order counts and low-stock metrics for the
 * shop dashboard. Calls the get_shop_dashboard_summary() RPC.
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: caller must be shop owner or admin.
 *
 * @param shopId - UUID of the shop.
 */
export async function getShopDashboardSummary(
  shopId: string,
): Promise<ShopDashboardSummary> {
  const { data, error } = await supabase.rpc("get_shop_dashboard_summary", {
    p_shop_id: shopId,
  });

  if (error) throw error;

  const d = data as {
    liveOrderCount:      number;
    pendingPackingCount: number;
    readyForPickupCount: number;
    completedToday:      number;
    grossSalesToday:     number;
    lowStockItemCount:   number;
  };

  return {
    liveOrderCount:      d.liveOrderCount,
    pendingPackingCount: d.pendingPackingCount,
    readyForPickupCount: d.readyForPickupCount,
    completedToday:      d.completedToday,
    grossSalesToday:     d.grossSalesToday,
    lowStockItemCount:   d.lowStockItemCount,
  } satisfies ShopDashboardSummary;
}

// ─────────────────────────────────────────────────────────────
// Orders — Read
// ─────────────────────────────────────────────────────────────

/**
 * Returns the list of orders for a shop, newest first.
 * Optionally filtered to one or more statuses.
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: is_shop_owner(shop_id) or is_admin().
 *
 * @param shopId       - UUID of the shop.
 * @param statusFilter - Optional array of statuses to filter by.
 */
export async function getIncomingOrders(
  shopId: string,
  statusFilter?: ShopOrderStatus[],
): Promise<ShopOrder[]> {
  let query = supabase
    .from("customer_orders")
    .select(
      "id, shop_id, customer_id, reference, pickup_pin, status, " +
      "payment_method, payment_status, customer_name, customer_phone, " +
      "packing_instructions, travel_method, pickup_start_at, pickup_end_at, " +
      "subtotal_lkr, savings_lkr, service_fee_lkr, total_lkr, " +
      "created_at, updated_at, accepted_at, packing_started_at, ready_at",
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data as unknown as Record<string, unknown>[]) ?? []).map(
    (row) => mapOrderRow(row),
  );
}

/**
 * Returns full details for a single order, including all line items.
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: is_shop_owner(shop_id) or is_admin().
 *
 * @param orderId - UUID of the order.
 */
export async function getShopOrderById(
  orderId: string,
): Promise<ShopOrder | null> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select(
      "id, shop_id, customer_id, reference, pickup_pin, status, " +
      "payment_method, payment_status, customer_name, customer_phone, " +
      "packing_instructions, travel_method, pickup_start_at, pickup_end_at, " +
      "subtotal_lkr, savings_lkr, service_fee_lkr, total_lkr, " +
      "created_at, updated_at, accepted_at, packing_started_at, ready_at, " +
      "customer_order_items(id, order_id, product_id, product_name, " +
      "product_unit, image_url, quantity, unit_price_lkr, substitution, " +
      "is_packed, packed_at)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  const rawItems = (row["customer_order_items"] as Record<string, unknown>[]) ?? [];
  const items: ShopOrderItem[] = rawItems.map(mapItemRow);

  return mapOrderRow(row, items);
}

// ─────────────────────────────────────────────────────────────
// Orders — Update
// ─────────────────────────────────────────────────────────────

/**
 * Transitions an order to a new lifecycle status.
 * Automatically sets the corresponding SLA timestamp.
 *
 * Allowed transitions (enforced by canTransitionShopOrder()):
 *   placed → accepted
 *   accepted → packing
 *   packing → ready
 *   ready → collected
 *   placed | accepted → cancelled
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: is_shop_owner(shop_id) or is_admin().
 * Column grant: UPDATE (status, updated_at, accepted_at,
 *               packing_started_at, ready_at) only.
 *
 * @param orderId   - UUID of the order.
 * @param newStatus - Target status.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: ShopOrderStatus,
): Promise<void> {
  const { error } = await supabase
    .from("customer_orders")
    .update({
      status: newStatus,
      ...slaTimestampFor(newStatus),
    })
    .eq("id", orderId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Packing
// ─────────────────────────────────────────────────────────────

/**
 * Marks a single order item as packed (or unpacked).
 * Writes to customer_order_items.is_packed and packed_at.
 *
 * Requires: migration 006 applied (is_packed, packed_at columns).
 * RLS: shop owner can UPDATE is_packed / packed_at.
 *
 * @param itemId   - UUID of the customer_order_items row.
 * @param isPacked - True to mark as packed; false to unmark.
 */
export async function updatePackingItem(
  itemId: string,
  isPacked: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("customer_order_items")
    .update({
      is_packed: isPacked,
      packed_at: isPacked ? new Date().toISOString() : null,
    })
    .eq("id", itemId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────────────────────

/**
 * Returns all inventory items for a shop, joined with product details.
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: is_shop_owner(shop_id) or is_admin().
 *
 * @param shopId - UUID of the shop.
 */
export async function getInventory(shopId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("shop_inventory")
    .select(
      "id, shop_id, product_id, quantity, low_stock_threshold, " +
      "is_available, updated_at, " +
      "customer_products(id, shop_id, name, unit, price_lkr, " +
      "regular_price_lkr, image_url, active)",
    )
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data as unknown as Record<string, unknown>[]) ?? []).map((row) => {
    const p = row.customer_products as Record<string, unknown> | null;
    const qty = row.quantity as number;
    const threshold = row.low_stock_threshold as number;

    return {
      id:                row.id as string,
      shopId:            row.shop_id as string,
      productId:         row.product_id as string,
      quantity:          qty,
      lowStockThreshold: threshold,
      isAvailable:       row.is_available as boolean,
      updatedAt:         row.updated_at as string,
      product: p
        ? {
            id:              p.id as string,
            shopId:          p.shop_id as string,
            name:            p.name as string,
            unit:            p.unit as string,
            priceLkr:        p.price_lkr as number,
            regularPriceLkr: p.regular_price_lkr as number,
            imageUrl:        (p.image_url as string | null) ?? null,
            active:          p.active as boolean,
          }
        : {
            id: row.product_id as string, shopId, name: "Unknown product",
            unit: "", priceLkr: 0, regularPriceLkr: 0,
            imageUrl: null, active: false,
          },
      stockStatus:
        qty === 0
          ? "out_of_stock"
          : qty <= threshold
          ? "low_stock"
          : "in_stock",
    } satisfies InventoryItem;
  });
}

/**
 * Updates the stock quantity and per-shop availability for a product.
 *
 * Requires: migration 006 applied.
 * RLS: is_shop_owner(shop_id).
 * Column grant: UPDATE (quantity, is_available, updated_at) via shop policy.
 *
 * @param shopId      - UUID of the shop.
 * @param productId   - UUID of the customer_product.
 * @param quantity    - New stock quantity (non-negative integer).
 * @param isAvailable - Whether the product is available for ordering.
 */
export async function updateStock(
  shopId: string,
  productId: string,
  quantity: number,
  isAvailable: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("shop_inventory")
    .update({
      quantity,
      is_available: isAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq("shop_id", shopId)
    .eq("product_id", productId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// QR / PIN Pickup Verification
// ─────────────────────────────────────────────────────────────

/**
 * Verifies a pickup PIN entered by the staff member on handover.
 *
 * Looks up the order by orderId, checks that the provided PIN
 * matches customer_orders.pickup_pin, then:
 *   1. Updates the order status to 'collected'.
 *   2. Writes a pickup_verifications record.
 *
 * Requires: migrations 005 + 006 applied.
 * RLS: shop owner can UPDATE order status; INSERT pickup_verifications.
 *
 * @param orderId    - UUID of the order being handed over.
 * @param pin        - 4-digit PIN entered by staff (from customer).
 * @param staffId    - UUID of the shop_staff row performing the handover.
 * @param method     - Verification method (default: 'pin').
 * @returns The matched order's reference and customer name, or null if PIN invalid.
 */
export async function verifyPickup(
  orderId: string,
  pin: string,
  staffId?: string,
  method: PickupVerification["verificationMethod"] = "pin",
): Promise<{ orderId: string; reference: string; customerName: string } | null> {
  // 1. Fetch order — confirm PIN matches
  const { data: order, error: fetchError } = await supabase
    .from("customer_orders")
    .select("id, reference, customer_name, pickup_pin, status, shop_id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!order) return null;
  if (order.pickup_pin !== pin) return null;
  if (order.status === "collected" || order.status === "cancelled") return null;

  // 2. Update order status to 'collected'
  const { error: updateError } = await supabase
    .from("customer_orders")
    .update({ status: "collected", ...slaTimestampFor("collected") })
    .eq("id", orderId);

  if (updateError) throw updateError;

  // 3. Write pickup verification record
  const { error: verifyError } = await supabase
    .from("pickup_verifications")
    .insert({
      order_id:            orderId,
      verified_by:         staffId ?? null,
      verification_method: method,
      handover_status:     "completed",
    });

  if (verifyError) throw verifyError;

  return {
    orderId:      order.id,
    reference:    order.reference,
    customerName: order.customer_name,
  };
}

// ─────────────────────────────────────────────────────────────
// Security Events
// ─────────────────────────────────────────────────────────────

/**
 * Inserts a security event into the monitoring feed.
 * Callable by any authenticated user (for client-side logging of
 * failed logins before a session exists).
 *
 * Requires: migration 006 applied.
 *
 * @param event - Partial event payload (id, created_at auto-generated).
 */
export async function logSecurityEvent(event: {
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  title: string;
  description?: string;
  userId?: string;
  shopId?: string;
  staffId?: string;
}): Promise<void> {
  const { error } = await supabase.from("security_events").insert({
    event_type:  event.eventType,
    severity:    event.severity,
    title:       event.title,
    description: event.description ?? null,
    user_id:     event.userId ?? null,
    shop_id:     event.shopId ?? null,
    staff_id:    event.staffId ?? null,
  });

  if (error) throw error;
}

/**
 * Returns the most recent security events for the admin dashboard.
 * Admin-only: enforced by RLS on security_events.
 *
 * Requires: migration 006 applied.
 *
 * @param limit - Maximum number of events to return (default 50).
 */
export async function getSecurityEvents(
  limit = 50,
): Promise<SecurityEvent[]> {
  const { data, error } = await supabase
    .from("security_events")
    .select(
      "id, event_type, severity, title, description, " +
      "user_id, shop_id, staff_id, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data as unknown as Record<string, unknown>[]) ?? []).map((row) => ({
    id:          row.id as string,
    eventType:   row.event_type as SecurityEventType,
    severity:    row.severity as SecurityEventSeverity,
    title:       row.title as string,
    description: (row.description as string | null) ?? null,
    userId:      (row.user_id as string | null) ?? null,
    shopId:      (row.shop_id as string | null) ?? null,
    staffId:     (row.staff_id as string | null) ?? null,
    status:      row.status as SecurityEvent["status"],
    createdAt:   row.created_at as string,
  }));
}

// ─────────────────────────────────────────────────────────────
// Admin Dashboard
// ─────────────────────────────────────────────────────────────

/**
 * Returns top-level admin dashboard metrics.
 * Admin-only (is_admin() RLS enforced on aggregated tables).
 *
 * Requires: migrations 005 + 006 applied.
 */
export async function getAdminDashboardSummary(): Promise<{
  activeShops: number;
  activeUsers: number;
  ordersToday: number;
  openSecurityAlerts: number;
}> {
  const [shops, orders, alerts, profiles] = await Promise.all([
    supabase
      .from("customer_shops")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("customer_orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  if (shops.error)    throw shops.error;
  if (orders.error)   throw orders.error;
  if (alerts.error)   throw alerts.error;
  if (profiles.error) throw profiles.error;

  return {
    activeShops:        shops.count   ?? 0,
    activeUsers:        profiles.count ?? 0,
    ordersToday:        orders.count   ?? 0,
    openSecurityAlerts: alerts.count   ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Internal row mappers
// ─────────────────────────────────────────────────────────────

function mapOrderRow(
  row: Record<string, unknown>,
  items?: ShopOrderItem[],
): ShopOrder {
  const order: ShopOrder = {
    id:                  row.id as string,
    shopId:              row.shop_id as string,
    customerId:          row.customer_id as string,
    reference:           row.reference as string,
    pickupPin:           row.pickup_pin as string,
    status:              row.status as ShopOrderStatus,
    paymentMethod:       row.payment_method as ShopOrder["paymentMethod"],
    paymentStatus:       row.payment_status as ShopOrder["paymentStatus"],
    customerName:        row.customer_name as string,
    customerPhone:       row.customer_phone as string,
    packingInstructions: row.packing_instructions as string,
    travelMethod:        row.travel_method as ShopOrder["travelMethod"],
    pickupStartAt:       row.pickup_start_at as string,
    pickupEndAt:         row.pickup_end_at as string,
    subtotalLkr:         row.subtotal_lkr as number,
    savingsLkr:          row.savings_lkr as number,
    serviceFeeLkr:       row.service_fee_lkr as number,
    totalLkr:            row.total_lkr as number,
    createdAt:           row.created_at as string,
    updatedAt:           (row.updated_at as string) ?? (row.created_at as string),
    acceptedAt:          (row.accepted_at as string | null) ?? null,
    packingStartedAt:    (row.packing_started_at as string | null) ?? null,
    readyAt:             (row.ready_at as string | null) ?? null,
  };

  if (items) {
    order.items = items;
    const packed = items.filter((i) => i.isPacked).length;
    order.packingStatus =
      packed === 0
        ? "unpacked"
        : packed === items.length
        ? "fully_packed"
        : "partial";
  }

  return order;
}

function mapItemRow(row: Record<string, unknown>): ShopOrderItem {
  return {
    id:           row.id as string,
    orderId:      row.order_id as string,
    productId:    (row.product_id as string | null) ?? null,
    productName:  row.product_name as string,
    productUnit:  row.product_unit as string,
    imageUrl:     (row.image_url as string | null) ?? null,
    quantity:     row.quantity as number,
    unitPriceLkr: row.unit_price_lkr as number,
    substitution: (row.substitution as ShopOrderItem["substitution"]) ?? { type: "call" },
    isPacked:     (row.is_packed as boolean) ?? false,
    packedAt:     (row.packed_at as string | null) ?? null,
  };
}

const SHOP_COLUMNS =
  "id, owner_id, name, description, category, address, phone, image_url, is_active, created_at, updated_at";

function toShop(row: Record<string, unknown>): Shop {
  return row as unknown as Shop;
}

/** Shops owned by the signed-in user, for the shop management screen. */
export async function listMyShops(): Promise<Shop[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toShop);
}

/** All active shops, for browsing. */
export async function listShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toShop);
}

export async function getShop(id: string): Promise<Shop> {
  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("id", id)
    .single();

  if (error) throw error;
  return toShop(data);
}

export async function createShop(input: ShopInput): Promise<Shop> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("shops")
    .insert({
      owner_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: input.category?.trim() || "Grocery",
      address: input.address?.trim() ?? "",
      phone: input.phone?.trim() || null,
      image_url: input.image_url ?? null,
      is_active: input.is_active ?? true,
    })
    .select(SHOP_COLUMNS)
    .single();

  if (error) throw error;
  return toShop(data);
}

export async function updateShop(
  id: string,
  changes: ShopUpdate,
): Promise<Shop> {
  const { data, error } = await supabase
    .from("shops")
    .update(changes)
    .eq("id", id)
    .select(SHOP_COLUMNS)
    .single();

  if (error) throw error;
  return toShop(data);
}

export async function deleteShop(id: string) {
  const { error } = await supabase.from("shops").delete().eq("id", id);
  if (error) throw error;
}
