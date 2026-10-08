-- =============================================================================
-- 020 - Shop staff access to Shop Management
--
-- WHAT WAS BROKEN
--
-- 1. The screen could not resolve its shop for staff.
--    app/(shop)/shop-management.tsx loads shops through listMyShops(), which
--    calls currentUserId() -> supabase.auth.getUser(). Staff sign in with a PIN
--    and hold a token in AsyncStorage; they have no Supabase session at all, so
--    currentUserId() threw and the page never rendered a shop.
--
--    get_staff_profile() does not help as written: it returns staff_code and
--    shop_name but not shop_id, and the screen needs the id to load that shop's
--    products. staff_my_shop() below returns the full context.
--
-- 2. Delete never worked for anyone.
--    Both deleteCanonicalProduct() and deleteShopProduct() called
--    archive_shop_product, which does not exist in the deployed database
--    (PostgREST answers PGRST202), so the Delete button failed outright.
--
-- WHY ARCHIVE AND NOT DELETE
--
-- customer_order_items.product_id references customer_products(id). A hard
-- DELETE would fail on any product that appears in a historical order, and
-- would destroy the name and price recorded at the time of sale. Archiving sets
-- active = false instead, which already removes the product from customer search
-- because every customer-facing read filters on active = true.
--
-- Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. staff_my_shop
--
-- Returns the shop the signed-in staff member belongs to. This is the lookup the
-- Shop Management screen uses instead of listMyShops() when there is no Supabase
-- session, and it is what lets a clerk reach Add / Discount / Delete.
--
-- Revoked from PUBLIC and granted to anon, following the 016 pattern: the
-- SECURITY DEFINER body is the only thing standing between the caller and the
-- shop_staff table, and resolve_staff_session() re-checks expiry and revocation
-- on every call.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_my_shop(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx  record;
  v_shop record;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT cs.id, cs.name, cs.address, cs.pickup_counter,
         cs.is_open, cs.preparation_minutes, cs.shop_code
  INTO v_shop
  FROM public.customer_shops cs
  WHERE cs.id = v_ctx.shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'shop_id',            v_shop.id,
    'shop_name',          v_shop.name,
    'shop_address',       v_shop.address,
    'shop_pickup_counter', v_shop.pickup_counter,
    'shop_is_open',       v_shop.is_open,
    'shop_prep_minutes',  v_shop.preparation_minutes,
    'shop_code',          v_shop.shop_code,
    'staff_id',           v_ctx.staff_id,
    'staff_code',         v_ctx.staff_code
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_my_shop(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_my_shop(text)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. staff_archive_product
--
-- Soft-deletes a listing. Refuses products owned by another shop, exactly as
-- staff_update_product and staff_set_product_stock do.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_archive_product(
  p_token      text,
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id      uuid;
  v_product_shop uuid;
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

  UPDATE public.customer_products
  SET active = false,
      available = false
  WHERE id = p_product_id;

  -- The inventory row is left in place so an un-archive, or a later restock,
  -- still has the quantity history rather than losing it on delete.
  UPDATE public.shop_inventory
  SET is_available = false,
      updated_at = now()
  WHERE shop_id = v_shop_id
    AND product_id = p_product_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_archive_product(text, uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_archive_product(text, uuid)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- VERIFY - both should appear with anon_can_execute = t
-- -----------------------------------------------------------------------------
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                        as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')    as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('staff_my_shop', 'staff_archive_product')
order by p.proname;
