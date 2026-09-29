import { useState } from "react";

export function useProducts() {
  const [products, setProducts] = useState<unknown[]>([]);

  return {
    products,
    setProducts,
  };
}
