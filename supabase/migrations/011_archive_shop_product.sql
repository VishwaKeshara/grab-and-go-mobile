CREATE OR REPLACE FUNCTION public.archive_shop_product(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT shop_id INTO v_shop_id
  FROM public.customer_products
  WHERE id = p_product_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_shops cs
    WHERE cs.id = v_shop_id
      AND cs.profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  UPDATE public.customer_products
  SET active = false
  WHERE id = p_product_id;

  UPDATE public.shop_inventory
  SET is_available = false
  WHERE product_id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_shop_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_shop_product(uuid) TO authenticated;
