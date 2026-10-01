import type { CartItem, CheckoutDraft } from "@/types/cart";

export type OrderStatus = "placed" | "accepted" | "packing" | "ready" | "collected" | "cancelled";

export type Order = {
  id: string;
  reference: string;
  pin: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: "paid_demo" | "pay_at_pickup";
  items: CartItem[];
  draft: CheckoutDraft;
  subtotal: number;
  savings: number;
  serviceFee: number;
  total: number;
};
