/**
 * TypeScript models for the Grab & Go Shop / Merchant module.
 *
 * ⚠️  DATABASE STATUS: These interfaces define the CLIENT-SIDE data shape only.
 *     The Supabase tables (shops, shop_staff, terminals) have NOT yet been
 *     confirmed in the live project. Connect services once migration 005+ is
 *     applied and verified.
 *
 * @see services/shopService.ts for pending Supabase integration TODOs.
 */

/** Role of the staff member currently operating the terminal. */
export type ShopRole = "clerk" | "manager";

/** Active work shift period. */
export type ShiftType = "morning" | "evening";

/**
 * Core shop / merchant profile.
 * In Supabase this links to a `profiles` row where `role = 'shop'`.
 *
 * TODO (migration 005): maps to the `shops` table.
 */
export interface ShopProfile {
  id: string;
  /** FK → profiles.id where profiles.role = 'shop' */
  profileId: string;
  name: string;
  counterNumber: string;
  hubName: string;
  hubId: string;
  terminalId: string;
  isActive: boolean;
  openedAt: string | null;
  createdAt: string;
}

/**
 * A staff member assigned to operate a shop terminal.
 *
 * TODO (migration 005): maps to the `shop_staff` table.
 */
export interface ShopStaff {
  id: string;
  shopId: string;
  /** Human-readable staff code displayed on shift summaries, e.g. "KW-07". */
  staffCode: string;
  fullName: string;
  phone: string;
  role: ShopRole;
  isActive: boolean;
}

/** Shift definition for display and scheduling purposes. */
export interface Shift {
  type: ShiftType;
  label: string;
  /** 24-hour format, e.g. "07:00" */
  startTime: string;
  /** 24-hour format, e.g. "14:00" */
  endTime: string;
}

/**
 * A POS terminal assigned to a shop counter.
 *
 * TODO (migration 005): maps to the `terminals` table.
 */
export interface Terminal {
  id: string;
  /** Human-readable terminal code, e.g. "MLB-B02-POS". */
  terminalCode: string;
  shopId: string;
  isReady: boolean;
}

/**
 * Aggregated metrics snapshot for the shop dashboard.
 * All counts represent the current calendar day unless stated otherwise.
 *
 * TODO: populate via shopService.getShopDashboardSummary() once
 *       migrations 005 & 006 are confirmed applied.
 */
export interface ShopDashboardSummary {
  liveOrderCount: number;
  pendingPackingCount: number;
  readyForPickupCount: number;
  completedToday: number;
  /** Total gross revenue today in LKR (cents or decimal as agreed). */
  grossSalesToday: number;
  queueLength: number;
  handoversToday: number;
  lowStockItemCount: number;
  activeShift: ShiftType | null;
}
