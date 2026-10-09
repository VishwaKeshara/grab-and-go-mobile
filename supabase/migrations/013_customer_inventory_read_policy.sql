BEGIN;

DROP POLICY IF EXISTS "Customers can read active shop inventory" ON public.shop_inventory;

CREATE POLICY "Customers can read active shop inventory"
ON public.shop_inventory FOR SELECT
TO authenticated
USING (
  is_available = true
  AND public.is_active_customer()
  AND EXISTS (
    SELECT 1
    FROM public.customer_products cp
    JOIN public.customer_shops cs ON cs.id = cp.shop_id
    WHERE cp.id = shop_inventory.product_id
      AND cp.shop_id = shop_inventory.shop_id
      AND cp.active = true
      AND cs.active = true
  )
);

COMMIT;
