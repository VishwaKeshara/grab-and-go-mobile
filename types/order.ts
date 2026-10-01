/**
 * Order-related TypeScript types for the shop module.
 *
 * ⚠️  DATABASE STATUS: These types represent the shop-side view of customer
 *     orders. No Supabase schema has been confirmed yet for orders.
 *     Coordinate with JayaniShehara-Order_Payment on the final schema before
 *     writing migrations.
 *
 * TODO (migration 006): maps to `orders`, `order_items`, `pickup_passes` tables.
 */

/**
 * Full lifecycle of a shop order from placement to collection.
 *
 * State machine:
 *   new → accepted → packing → ready → completed
 *   new → rejected
 *   accepted → rejected
 */
export type OrderStatus =
  | "new"
  | "accepted"
  | "packing"
  | "ready"
  | "completed"
  | "rejected";

/** Packing progress within a single order — derived from order_items.is_packed. */
export type PackingStatus = "unpacked" | "partial" | "fully_packed";

/** Status of the customer pickup handover step. */
export type PickupStatus = "pending" | "verified" | "collected";

/**
 * A single line item within a shop order.
 *
 * TODO: maps to the `order_items` table joined with `products`.
 */
export interface ShopOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  /** Price at the time of order in LKR. */
  unitPrice: number;
  unitLabel: string;
  isPacked: boolean;
  substituteProductId: string | null;
}

/**
 * A customer order as seen from the shop-staff perspective.
 *
 * TODO: maps to the `orders` table joined with `profiles` (for customer info).
 *
 * The `items` field is populated only when a detail view is explicitly requested
 * via shopService.getShopOrderById(). List views omit it.
 */
export interface ShopOrder {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  packingStatus: PackingStatus;
  pickupStatus: PickupStatus;
  /** Total order value in LKR. */
  totalAmount: number;
  itemCount: number;
  /** Populated on detail views only — undefined in list views. */
  items?: ShopOrderItem[];
  pickupScheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
