/**
 * Order types for the shop-operator module.
 *
 * Maps to the following Supabase tables (migrations 005 + 006):
 *   customer_orders      — order records (005 + 006 extension)
 *   customer_order_items — line items   (005 + 006 extension)
 *   pickup_verifications — handover log (006)
 *
 * @see services/shopService.ts for all Supabase integration.
 */

// ─────────────────────────────────────────────────────────────
// Status types
// ─────────────────────────────────────────────────────────────

/**
 * Lifecycle status of an order from the shop's perspective.
 *
 * Maps to: customer_orders.status CHECK constraint (migration 005):
 *   'placed' | 'accepted' | 'packing' | 'ready' | 'collected' | 'cancelled'
 *
 * Note: The DB uses 'collected' (not 'completed') and 'placed' (not 'new').
 * These match the customer_orders CHECK exactly.
 */
export type ShopOrderStatus =
  | "placed"      // customer submitted — awaiting shop acceptance
  | "accepted"    // shop accepted — ready to start packing
  | "packing"     // shop is actively packing items
  | "ready"       // all items packed — awaiting customer pickup
  | "collected"   // handover verified — order complete
  | "cancelled";  // order cancelled (placed or accepted stage only)

/**
 * Computed packing progress, derived client-side from
 * the is_packed state of all items in customer_order_items.
 * Not stored in the database.
 */
export type PackingStatus = "unpacked" | "partial" | "fully_packed";

/**
 * Handover state for QR verification screen.
 * Derived from pickup_verifications or customer_orders.status.
 */
export type PickupStatus = "pending" | "verified" | "collected";

// ─────────────────────────────────────────────────────────────
// ShopOrderItem
// Maps to: public.customer_order_items (005 + 006 additions)
// ─────────────────────────────────────────────────────────────

/**
 * A single line item within a shop order.
 *
 * Column mapping:
 *   id                → customer_order_items.id
 *   orderId           → customer_order_items.order_id
 *   productId         → customer_order_items.product_id  (nullable in DB)
 *   productName       → customer_order_items.product_name  (snapshot)
 *   productUnit       → customer_order_items.product_unit  (snapshot)
 *   imageUrl          → customer_order_items.image_url
 *   quantity          → customer_order_items.quantity
 *   unitPriceLkr      → customer_order_items.unit_price_lkr
 *   substitution      → customer_order_items.substitution (jsonb)
 *   isPacked          → customer_order_items.is_packed  (migration 006)
 *   packedAt          → customer_order_items.packed_at  (migration 006)
 */
export interface ShopOrderItem {
  id: string;
  orderId: string;
  /** Nullable — product snapshot is preserved even if product is deleted. */
  productId: string | null;
  productName: string;
  productUnit: string;
  imageUrl: string | null;
  quantity: number;
  unitPriceLkr: number;
  /** Substitution preference from the customer (jsonb). */
  substitution: { type: "call" } | { type: "none" } | { type: "alternative"; productId: string };
  /** Per-item packing state (migration 006). */
  isPacked: boolean;
  /** Timestamp when this item was packed (migration 006). */
  packedAt: string | null;
}

// ─────────────────────────────────────────────────────────────
// ShopOrder
// Maps to: public.customer_orders (005 + 006 additions)
// ─────────────────────────────────────────────────────────────

/**
 * A customer order as seen by the shop operator.
 *
 * Column mapping:
 *   id                  → customer_orders.id
 *   shopId              → customer_orders.shop_id
 *   customerId          → customer_orders.customer_id
 *   reference           → customer_orders.reference
 *   pickupPin           → customer_orders.pickup_pin
 *   status              → customer_orders.status
 *   paymentMethod       → customer_orders.payment_method
 *   paymentStatus       → customer_orders.payment_status
 *   customerName        → customer_orders.customer_name
 *   customerPhone       → customer_orders.customer_phone
 *   packingInstructions → customer_orders.packing_instructions
 *   travelMethod        → customer_orders.travel_method
 *   pickupStartAt       → customer_orders.pickup_start_at
 *   pickupEndAt         → customer_orders.pickup_end_at
 *   subtotalLkr         → customer_orders.subtotal_lkr
 *   savingsLkr          → customer_orders.savings_lkr
 *   serviceFeeLkr       → customer_orders.service_fee_lkr
 *   totalLkr            → customer_orders.total_lkr
 *   createdAt           → customer_orders.created_at
 *   updatedAt           → customer_orders.updated_at       (migration 006)
 *   acceptedAt          → customer_orders.accepted_at      (migration 006)
 *   packingStartedAt    → customer_orders.packing_started_at (migration 006)
 *   readyAt             → customer_orders.ready_at         (migration 006)
 *
 *   items               → joined from customer_order_items (optional)
 *   packingStatus       → computed client-side from items[].isPacked
 */
export interface ShopOrder {
  id: string;
  shopId: string;
  customerId: string;
  reference: string;
  pickupPin: string;
  status: ShopOrderStatus;
  paymentMethod: "wallet" | "card" | "pickup";
  paymentStatus: "paid" | "pay_at_pickup" | "failed";
  customerName: string;
  customerPhone: string;
  packingInstructions: string;
  travelMethod: "walking" | "motorcycle" | "car";
  pickupStartAt: string;
  pickupEndAt: string;
  subtotalLkr: number;
  savingsLkr: number;
  serviceFeeLkr: number;
  totalLkr: number;
  createdAt: string;
  /** Auto-updated by trigger on every UPDATE (migration 006). */
  updatedAt: string;
  /** Set when shop transitions status → 'accepted' (migration 006). */
  acceptedAt: string | null;
  /** Set when shop transitions status → 'packing' (migration 006). */
  packingStartedAt: string | null;
  /** Set when shop transitions status → 'ready' (migration 006). */
  readyAt: string | null;
  /** Present when fetched with order items (optional join). */
  items?: ShopOrderItem[];
  /** Computed client-side from items[].isPacked. Not stored in DB. */
  packingStatus?: PackingStatus;
}

// ─────────────────────────────────────────────────────────────
// PickupVerification
// Maps to: public.pickup_verifications (migration 006)
// ─────────────────────────────────────────────────────────────

/**
 * A handover event record written when a staff member completes pickup.
 *
 * Column mapping:
 *   id                 → pickup_verifications.id
 *   orderId            → pickup_verifications.order_id
 *   verifiedBy         → pickup_verifications.verified_by (FK → shop_staff)
 *   verificationMethod → pickup_verifications.verification_method
 *   handoverStatus     → pickup_verifications.handover_status
 *   notes              → pickup_verifications.notes
 *   verifiedAt         → pickup_verifications.verified_at
 */
export interface PickupVerification {
  id: string;
  orderId: string;
  verifiedBy: string | null;
  verificationMethod: "pin" | "qr" | "manual";
  handoverStatus: "completed" | "rejected" | "partial";
  notes: string | null;
  verifiedAt: string;
}

// ─────────────────────────────────────────────────────────────
// SecurityEvent
// Maps to: public.security_events (migration 006)
// ─────────────────────────────────────────────────────────────

export type SecurityEventType =
  | "failed_login"
  | "pin_lockout"
  | "admin_login"
  | "terminal_auth"
  | "geofence"
  | "order_anomaly"
  | "key_rotation"
  | "status_change";

export type SecurityEventSeverity = "info" | "warning" | "critical";
export type SecurityEventStatus = "open" | "reviewed" | "resolved";

/**
 * A security event entry in the admin monitoring feed.
 *
 * Column mapping:
 *   id          → security_events.id
 *   eventType   → security_events.event_type
 *   severity    → security_events.severity
 *   title       → security_events.title
 *   description → security_events.description
 *   userId      → security_events.user_id
 *   shopId      → security_events.shop_id
 *   staffId     → security_events.staff_id
 *   status      → security_events.status
 *   createdAt   → security_events.created_at
 */
export interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  title: string;
  description: string | null;
  userId: string | null;
  shopId: string | null;
  staffId: string | null;
  status: SecurityEventStatus;
  createdAt: string;
}
