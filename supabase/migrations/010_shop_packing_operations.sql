CREATE OR REPLACE FUNCTION public.set_shop_order_item_packed(
  p_order_item_id uuid,
  p_packed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_order_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    co.shop_id,
    co.status
  INTO
    v_shop_id,
    v_order_status
  FROM public.customer_order_items coi
  JOIN public.customer_orders co
    ON co.id = coi.order_id
  WHERE coi.id = p_order_item_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_shops cs
    WHERE cs.id = v_shop_id
      AND cs.profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  IF v_order_status NOT IN ('accepted', 'packing') THEN
    RAISE EXCEPTION 'Order cannot be packed in its current status';
  END IF;

  UPDATE public.customer_order_items
  SET
    is_packed = p_packed,
    packed_at = CASE
      WHEN p_packed THEN now()
      ELSE NULL
    END
  WHERE id = p_order_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_shop_order_item_packed(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_shop_order_item_packed(uuid, boolean) TO authenticated;
