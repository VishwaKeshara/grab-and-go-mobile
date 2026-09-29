import { useState } from "react";

export function useOrders() {
  const [orders, setOrders] = useState<unknown[]>([]);

  return {
    orders,
    setOrders,
  };
}
