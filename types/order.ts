import type { CartItem, CheckoutDraft, GroceryProduct, GroceryShop } from "@/types/cart";

export type OrderStatus = "placed" | "accepted" | "packing" | "ready" | "collected" | "cancelled";

export type OrderItem = CartItem & { id: string };
export type AddableOrderProduct = { product: GroceryProduct; stock: number };
export type OrderAdditionItem = { productId: string; quantity: number };

export type Order = {
  id: string;
  reference: string;
  pin: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: "paid" | "pay_at_pickup" | "failed" | "demo_unpaid";
  shop: GroceryShop;
  items: OrderItem[];
  draft: CheckoutDraft;
  subtotal: number;
  savings: number;
  serviceFee: number;
  total: number;
};
