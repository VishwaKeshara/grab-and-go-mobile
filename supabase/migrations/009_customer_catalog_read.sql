-- Migration 009: customer_catalog_read

-- Allow authenticated users to view shop inventory for active products in active shops
DROP POLICY IF EXISTS "Customers can view inventory for active products in active shops" ON public.shop_inventory;
CREATE POLICY "Customers can view inventory for active products in active shops"
ON public.shop_inventory
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_products cp
    WHERE cp.id = shop_inventory.product_id
    AND cp.active = true
  )
  AND
  EXISTS (
    SELECT 1 FROM public.customer_shops cs
    WHERE cs.id = shop_inventory.shop_id
    AND cs.active = true
  )
);
