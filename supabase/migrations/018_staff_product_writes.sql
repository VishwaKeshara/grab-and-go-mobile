-- =============================================================================
-- 018 - Staff-token product writes
--
-- WHY THIS FILE IS NEEDED
-- Shop screens sign in with a staff PIN and hold a token in AsyncStorage. That
-- token is NOT a Supabase auth session, so every request they make is executed
-- as the `anon` role using the publishable key.
--
-- Two things then block stock and product writes completely:
--
--   1. Privilege. The only grants on these tables are SELECT:
--        006_shop_operations.sql:680  grant select, update on shop_inventory
--                                     ... and no INSERT at all
--        005_customer_ordering.sql:83 grant select on customer_products
--      There is no INSERT grant on either table for any role.
--
--   2. RLS. Every write policy is `to authenticated`:
--        010_member2_all_tables.sql:374 / :386
--      An `anon` request is rejected by the policy regardless of grants.
--
-- Granting INSERT/UPDATE to `anon` would make both tables writable by anyone
-- holding the publishable key, which is public in the shipped app. So instead
-- these two functions are SECURITY DEFINER and validate the staff token
-- themselves, following the same pattern as 016_shop_staff_management.sql:
-- revoke from PUBLIC, then grant execute to anon.
--
-- The function derives the shop from the token, never from a caller-supplied
-- shop_id, so a valid clerk can only ever write to their own shop.
--
-- Safe to re-run.
-- =============================================================================


-- An earlier version of this file created staff_create_product without a
-- category parameter. Dropped first so re-running always leaves exactly one
-- definition and PostgREST cannot resolve the call ambiguously.
drop function if exists public.staff_create_product(text, text, text, integer, text, integer);


-- -----------------------------------------------------------------------------
-- 1. staff_create_product
--
-- Creates a product and its opening stock in one transaction.
--
-- Note customer_products.stock_quantity IS written here. The earlier
-- create_shop_product_with_inventory in 008 inserted into customer_products
-- without that column, so the quantity a clerk typed only ever reached
-- shop_inventory while customer_products.stock_quantity stayed at its default
-- of 0. Customer-facing search and the product page read stock_quantity
-- directly, which is why the catalogue showed no stock after adding it.
--
-- p_category_id is validated against product_categories so a bad id fails loudly
-- rather than silently leaving the product uncategorised.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_create_product(
  p_token             text,
  p_name              text,
  p_unit              text,
  p_price_lkr         integer,
  p_image_url         text,
  p_initial_quantity  integer,
  p_category_id       uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id   uuid;
  v_product_id uuid;
  v_qty       integer;
  v_category  uuid;
BEGIN
  SELECT r.shop_id
  INTO v_shop_id
  FROM public.resolve_staff_session(p_token) r;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Staff session is invalid or expired';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;

  IF p_price_lkr IS NULL OR p_price_lkr < 0 THEN
    RAISE EXCEPTION 'Selling price must be zero or more';
  END IF;

  v_qty := GREATEST(COALESCE(p_initial_quantity, 0), 0);
  v_category := NULL;

  IF p_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_categories
      WHERE id = p_category_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Selected category does not exist or is inactive';
    END IF;

    v_category := p_category_id;
  END IF;

  INSERT INTO public.customer_products (
    shop_id, name, unit, price_lkr, regular_price_lkr, image_url,
    active, available, stock_quantity, category_id
  )
  VALUES (
    v_shop_id,
    trim(p_name),
    COALESCE(NULLIF(trim(p_unit), ''), 'unit'),
    p_price_lkr,
    -- The form no longer collects a separate regular price.
    p_price_lkr,
    NULLIF(trim(COALESCE(p_image_url, '')), ''),
    true,
    v_qty > 0,
    v_qty,
    v_category
  )
  RETURNING id INTO v_product_id;

  INSERT INTO public.shop_inventory (
    shop_id, product_id, quantity, low_stock_threshold, is_available, updated_at
  )
  VALUES (
    v_shop_id, v_product_id, v_qty, 5, v_qty > 0, now()
  );

  RETURN v_product_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_create_product(text, text, text, integer, text, integer, uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_create_product(text, text, text, integer, text, integer, uuid)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. staff_set_product_stock
--
-- Sets stock for a product the caller's shop actually owns.
--
-- shop_inventory has no unique constraint on (shop_id, product_id), so
-- `ON CONFLICT` cannot be used here. The row is looked up and updated, or
-- inserted when the shop has never stocked the product -- which is every
-- product today, because that table started empty.
--
-- customer_products.stock_quantity and .available are written in the same
-- statement so the denormalised copy never drifts from the source of truth.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_set_product_stock(
  p_token        text,
  p_product_id   uuid,
  p_quantity     integer,
  p_is_available boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id     uuid;
  v_product_shop uuid;
  v_inventory_id uuid;
  v_qty         integer;
  v_available   boolean;
BEGIN
  SELECT r.shop_id
  INTO v_shop_id
  FROM public.resolve_staff_session(p_token) r;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Staff session is invalid or expired';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product is required';
  END IF;

  -- Confirms the product belongs to this shop, so one clerk cannot restock
  -- another shop's catalogue.
  SELECT shop_id
  INTO v_product_shop
  FROM public.customer_products
  WHERE id = p_product_id;

  IF v_product_shop IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product_shop <> v_shop_id THEN
    RAISE EXCEPTION 'This product belongs to another shop';
  END IF;

  v_qty := GREATEST(COALESCE(p_quantity, 0), 0);
  v_available := COALESCE(p_is_available, v_qty > 0);

  SELECT id
  INTO v_inventory_id
  FROM public.shop_inventory
  WHERE shop_id = v_shop_id
    AND product_id = p_product_id
  LIMIT 1;

  IF v_inventory_id IS NULL THEN
    INSERT INTO public.shop_inventory (
      shop_id, product_id, quantity, low_stock_threshold, is_available, updated_at
    )
    VALUES (
      v_shop_id, p_product_id, v_qty, 5, v_available, now()
    );
  ELSE
    UPDATE public.shop_inventory
    SET quantity = v_qty,
        is_available = v_available,
        updated_at = now()
    WHERE id = v_inventory_id;
  END IF;

  UPDATE public.customer_products
  SET stock_quantity = v_qty,
      available = v_available
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_set_product_stock(text, uuid, integer, boolean)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_set_product_stock(text, uuid, integer, boolean)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- NOTE ON staff_update_product
-- That function now lives in 019_product_discount_percent.sql, which adds the
-- discount_percent column and the server-side discount arithmetic. Defining it
-- here as well would mean whichever ran last silently won.
-- -----------------------------------------------------------------------------

-- VERIFY - all three should appear as present. Then sign in as staff and call.
-- -----------------------------------------------------------------------------
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                        as security_definer,
       has_function_privilege(
         'anon',
         p.oid,
         'EXECUTE'
       )                                                    as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('staff_create_product', 'staff_set_product_stock', 'staff_update_product')
order by p.proname;
