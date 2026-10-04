/**
 * TypeScript models for the Grab & Go Shop / Merchant module.
 *
 * Maps to the following Supabase tables (applied in migrations 005 + 006):
 *   customer_shops     — shop identity (005 + 006 extension)
 *   shop_staff         — staff members with bcrypt-hashed PINs (006)
 *
 * @see services/shopService.ts for all Supabase integration.
 * @see supabase/migrations/006_shop_operations.sql for schema.
 */

// ─────────────────────────────────────────────────────────────
// Enums / union types
// ─────────────────────────────────────────────────────────────

/** Role of the staff member operating the shop terminal. */
export type ShopRole = "clerk" | "manager";

/** Work shift period. */
export type ShiftType = "morning" | "evening";

// ─────────────────────────────────────────────────────────────
// ShopProfile
// Maps to: public.customer_shops (with 006 additions)
// ─────────────────────────────────────────────────────────────

/**
 * Core shop profile returned by getShopByProfileId().
 *
 * Column mapping:
 *   id             → customer_shops.id
 *   profileId      → customer_shops.profile_id (FK → profiles.id)
 *   hubId          → customer_shops.hub_id     (FK → pickup_hubs.id)
 *   name           → customer_shops.name
 *   address        → customer_shops.address
 *   phone          → customer_shops.phone
 *   pickupCounter  → customer_shops.pickup_counter
 *   prepMinutes    → customer_shops.preparation_minutes
 *   active         → customer_shops.active
 *   isOpen         → customer_shops.is_open
 *   openedAt       → customer_shops.opened_at
 */
export interface ShopProfile {
  id: string;
  /** FK → profiles.id where profiles.role = 'shop'. */
  profileId: string | null;
  /** FK → pickup_hubs.id. */
  hubId: string | null;
  name: string;
  address: string;
  phone: string | null;
  pickupCounter: string;
  prepMinutes: number;
  active: boolean;
  /** Real-time open/closed flag toggled per shift. */
  isOpen: boolean;
  openedAt: string | null;
}

// ─────────────────────────────────────────────────────────────
// ShopStaff
// Maps to: public.shop_staff (006)
// ─────────────────────────────────────────────────────────────

/**
 * A staff member returned from verifyStaffPin() RPC on success.
 * pin_hash is NEVER included — the RPC does not expose it.
 *
 * Column mapping:
 *   id        → shop_staff.id
 *   shopId    → shop_staff.shop_id
 *   staffCode → shop_staff.staff_code
 *   fullName  → shop_staff.full_name
 *   phone     → shop_staff.phone
 *   role      → shop_staff.role
 *   shift     → shop_staff.shift
 *   isActive  → shop_staff.is_active
 */
export interface ShopStaff {
  id: string;
  shopId: string;
  /** Human-readable staff code, e.g. "KW-07". */
  staffCode: string;
  fullName: string;
  phone: string | null;
  role: ShopRole;
  shift: ShiftType;
  isActive: boolean;
}

/**
 * Payload returned by the verify_staff_pin() Supabase RPC on success.
 * This is the only staff data the client ever receives from the RPC.
 */
export interface StaffLoginResult {
  success: true;
  staffId: string;
  staffCode: string;
  fullName: string;
  role: ShopRole;
  shift: ShiftType;
}

// ─────────────────────────────────────────────────────────────
// ShopDashboardSummary
// Populated by get_shop_dashboard_summary() RPC (006)
// ─────────────────────────────────────────────────────────────

/**
 * Aggregated metrics snapshot for the shop dashboard.
 * All counts are for the current calendar day unless noted.
 *
 * Sourced from:
 *   liveOrderCount      → COUNT customer_orders WHERE status IN ('placed','accepted')
 *   pendingPackingCount → COUNT customer_orders WHERE status = 'packing'
 *   readyForPickupCount → COUNT customer_orders WHERE status = 'ready'
 *   completedToday      → COUNT customer_orders WHERE status = 'collected' AND today
 *   grossSalesToday     → SUM total_lkr WHERE status != 'cancelled' AND today
 *   lowStockItemCount   → COUNT shop_inventory WHERE quantity <= low_stock_threshold
 */
export interface ShopDashboardSummary {
  liveOrderCount: number;
  pendingPackingCount: number;
  readyForPickupCount: number;
  completedToday: number;
  /** Gross revenue today in LKR (integer cents stored, display as LKR). */
  grossSalesToday: number;
  lowStockItemCount: number;
}
export type Shop = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopInput = {
  name: string;
  description?: string;
  category?: string;
  address?: string;
  phone?: string | null;
  image_url?: string | null;
  is_active?: boolean;
};

export type ShopUpdate = Partial<ShopInput>;
