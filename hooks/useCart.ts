import { useState } from 'react';

export function useCart() {
  const [itemCount, setItemCount] = useState(0);

  return {
    itemCount,
    setItemCount,
  };
}