BEGIN;

-- ============================================================
-- 1. Staff: Orders list
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_get_orders(
  p_token text,
  p_status text DEFAULT NULL
)
RETURNS SETOF public.customer_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Invalid or expired staff token';
  END IF;


  IF p_status IS NOT NULL
     AND p_status NOT IN (
       'placed',
       'accepted',
       'packing',
       'ready',
       'collected',
       'cancelled'
     ) THEN
    RAISE EXCEPTION
      'Invalid order status';
  END IF;


  RETURN QUERY
  SELECT co.*
  FROM public.customer_orders co
  WHERE co.shop_id = v_ctx.shop_id
    AND (
      p_status IS NULL
      OR co.status = p_status
    )
  ORDER BY co.created_at DESC;
END;
$$;


REVOKE ALL
ON FUNCTION public.staff_get_orders(text, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_get_orders(text, text)
TO anon, authenticated;


-- ============================================================
-- 2. Staff: Order details
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_get_order_details(
  p_token text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_order jsonb;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Invalid or expired staff token';
  END IF;


  SELECT
    to_jsonb(co)
    ||
    jsonb_build_object(
      'customer_order_items',
      COALESCE(
        (
          SELECT jsonb_agg(
            to_jsonb(coi)
            ORDER BY coi.id
          )
          FROM public.customer_order_items coi
          WHERE coi.order_id = co.id
        ),
        '[]'::jsonb
      )
    )
  INTO v_order
  FROM public.customer_orders co
  WHERE co.id = p_order_id
    AND co.shop_id = v_ctx.shop_id;


  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;


  RETURN v_order;
END;
$$;


REVOKE ALL
ON FUNCTION public.staff_get_order_details(text, uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_get_order_details(text, uuid)
TO anon, authenticated;


-- ============================================================
-- 3. Staff: Accept order
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_accept_order(
  p_token text,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_status text;
  v_updated integer;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Invalid or expired staff token';
  END IF;


  SELECT status
  INTO v_status
  FROM public.customer_orders
  WHERE id = p_order_id
    AND shop_id = v_ctx.shop_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;


  IF v_status <> 'placed' THEN
    RAISE EXCEPTION
      'Order cannot be accepted';
  END IF;


  UPDATE public.customer_orders
  SET
    status = 'accepted',
    accepted_at =
      coalesce(
        accepted_at,
        now()
      )
  WHERE id = p_order_id
    AND shop_id = v_ctx.shop_id
    AND status = 'placed';


  GET DIAGNOSTICS v_updated = ROW_COUNT;


  IF v_updated = 0 THEN
    RAISE EXCEPTION
      'Order cannot be accepted';
  END IF;
END;
$$;


REVOKE ALL
ON FUNCTION public.staff_accept_order(text, uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_accept_order(text, uuid)
TO anon, authenticated;


-- ============================================================
-- 4. Staff: Status transitions
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_set_order_status(
  p_token text,
  p_order_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_current_status text;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Invalid or expired staff token';
  END IF;


  SELECT status
  INTO v_current_status
  FROM public.customer_orders
  WHERE id = p_order_id
    AND shop_id = v_ctx.shop_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;


  IF NOT (
       (
         v_current_status = 'placed'
         AND p_status IN (
           'accepted',
           'cancelled'
         )
       )
    OR (
         v_current_status = 'accepted'
         AND p_status IN (
           'packing',
           'cancelled'
         )
       )
    OR (
         v_current_status = 'packing'
         AND p_status = 'ready'
       )
    OR (
         v_current_status = 'ready'
         AND p_status = 'collected'
       )
  ) THEN
    RAISE EXCEPTION
      'Invalid order status transition from % to %',
      v_current_status,
      p_status;
  END IF;


  UPDATE public.customer_orders
  SET
    status = p_status,

    accepted_at =
      CASE
        WHEN p_status = 'accepted'
        THEN coalesce(
          accepted_at,
          now()
        )
        ELSE accepted_at
      END,

    packing_started_at =
      CASE
        WHEN p_status = 'packing'
        THEN coalesce(
          packing_started_at,
          now()
        )
        ELSE packing_started_at
      END,

    ready_at =
      CASE
        WHEN p_status = 'ready'
        THEN coalesce(
          ready_at,
          now()
        )
        ELSE ready_at
      END

  WHERE id = p_order_id
    AND shop_id = v_ctx.shop_id;
  IF p_status = 'cancelled' THEN
    UPDATE public.shop_inventory inv
    SET
      quantity = inv.quantity + oi.quantity,
      updated_at = now()
    FROM public.customer_order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id = inv.product_id
      AND inv.shop_id = v_ctx.shop_id;
  END IF;

END;
$$;


REVOKE ALL
ON FUNCTION public.staff_set_order_status(
  text,
  uuid,
  text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_set_order_status(
  text,
  uuid,
  text
)
TO anon, authenticated;


-- ============================================================
-- 5. Staff: Packing item state
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_set_order_item_packed(
  p_token text,
  p_order_item_id uuid,
  p_packed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_order_status text;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Invalid or expired staff token';
  END IF;


  SELECT co.status
  INTO v_order_status
  FROM public.customer_order_items coi
  JOIN public.customer_orders co
    ON co.id = coi.order_id
  WHERE coi.id = p_order_item_id
    AND co.shop_id = v_ctx.shop_id;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Order item not found or not authorized';
  END IF;


  IF v_order_status NOT IN (
    'accepted',
    'packing'
  ) THEN
    RAISE EXCEPTION
      'Order cannot be packed in its current status';
  END IF;


  UPDATE public.customer_order_items
  SET
    is_packed = p_packed,

    packed_at =
      CASE
        WHEN p_packed
        THEN now()
        ELSE NULL
      END

  WHERE id = p_order_item_id;
END;
$$;


REVOKE ALL
ON FUNCTION public.staff_set_order_item_packed(
  text,
  uuid,
  boolean
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_set_order_item_packed(
  text,
  uuid,
  boolean
)
TO anon, authenticated;


COMMIT;