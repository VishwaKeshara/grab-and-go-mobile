import type { SubstitutePreference } from "@/types/cart";
import type { OrderStatus } from "@/types/order";

export type CustomerShopRow = {
  id: string; name: string; address: string; phone: string | null;
  pickup_counter: string; preparation_minutes: number;
  timezone: string; active: boolean;
};
export type CustomerProductDetailsRow = {
  id: string; shop_id: string; name: string; unit: string;
  price_lkr: number; regular_price_lkr: number; image_url: string | null;
};
export type CustomerProductRow = CustomerProductDetailsRow & {
  active: boolean; available: boolean; stock_quantity: number; substitute_for: string | null;
};
export type CustomerInventoryProductRow = CustomerProductDetailsRow & {
  active: boolean; substitute_for: string | null;
  shop_inventory: { quantity: number; is_available: boolean }[];
};
export type CustomerCartRow = {
  id: string; customer_id: string; shop_id: string | null;
};
export type CustomerCartItemRow = {
  product_id: string; quantity: number; substitution: SubstitutePreference;
};
export type CustomerOrderRow = {
  id: string; customer_id: string; shop_id: string; checkout_id: string;
  reference: string; pickup_pin: string; status: OrderStatus;
  payment_method: "wallet" | "card" | "pickup";
  payment_status: "paid" | "pay_at_pickup" | "failed" | "demo_unpaid";
  customer_name: string; customer_phone: string; packing_instructions: string;
  travel_method: "walking" | "motorcycle" | "car";
  pickup_start_at: string; pickup_end_at: string; pickup_mode: "express" | "scheduled";
  pickup_slot_id: string | null;
  subtotal_lkr: number; savings_lkr: number; service_fee_lkr: number;
  total_lkr: number; created_at: string;
};
export type CustomerOrderItemRow = {
  id: string; order_id: string; product_id: string | null;
  product_name: string; product_unit: string; image_url: string | null;
  quantity: number; unit_price_lkr: number; regular_price_lkr: number;
  substitution: SubstitutePreference;
};
