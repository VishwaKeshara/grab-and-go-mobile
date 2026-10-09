import { useCart } from "@/hooks/useCart";

/** Order screens share the same provider state used by cart and checkout. */
export function useOrders(): ReturnType<typeof useCart> {
  return useCart();
}
