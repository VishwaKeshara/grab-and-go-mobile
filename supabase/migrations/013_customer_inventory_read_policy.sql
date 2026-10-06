BEGIN;

CREATE POLICY "Customers can read active shop inventory"
ON public.shop_inventory FOR SELECT
TO authenticated
USING (is_available = true);

COMMIT;
