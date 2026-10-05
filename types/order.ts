import type { CartItem, CheckoutDraft, GroceryShop } from "@/types/cart";

export type OrderStatus = "placed" | "accepted" | "packing" | "ready" | "collected" | "cancelled";

export type Order = {
  id: string;
  reference: string;
  pin: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: "paid" | "pay_at_pickup" | "failed" | "demo_unpaid";
  shop: GroceryShop;
  items: CartItem[];
  draft: CheckoutDraft;
  subtotal: number;
  savings: number;
  serviceFee: number;
  total: number;
};
