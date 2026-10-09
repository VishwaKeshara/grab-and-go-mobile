-- =============================================================================
-- 025 - Permanently delete a product listing
--
-- WHY THIS FILE IS NEEDED
--
-- Shop Management's Delete button has always called deleteShopProduct, which
-- sets active = false and available = false. That is an archive, not a delete:
-- the row stays in customer_products forever and keeps taking up space, and the
-- button saying "Delete" while leaving the row behind is misleading. The shop
-- asked for a real delete.
--
-- WHY NOT A PLAIN `delete from customer_products`
--
-- Three foreign keys point at that table without ON DELETE CASCADE, so Postgres
-- refuses the delete (23503) rather than silently orphaning rows:
--
--   customer_order_items.product_id   historical orders. A sold item must keep
--                                      pointing at what was actually bought.
--   customer_cart_items.product_id    someone's live basket. Deleting the
--                                      product must take the basket line with it
--                                      or the cart is left referencing a row
--                                      that no longer exists.
--   customer_products.substitute_for  self-reference. A substitute exists only to
--                                      be swapped in for another product, so a
--                                      swap pointing at a deleted product is
--                                      meaningless rather than historical.
--
-- WHAT THIS FUNCTION DOES
--
--   1. confirms the caller owns the product (owner session) or holds a valid
--      staff token for its shop -- the same two checks the archive path uses
--   2. deletes the basket lines, which cascade-free block the delete
--   3. clears substitute_for on other products, for the same reason
--   4. REFUSES if the product appears in any order, rather than deleting the
--      history or nulling the reference. That refusal is the point of this file:
--      a product that was actually sold is kept, and the shop is told why.
--   5. deletes the row. shop_inventory and reviews/favourites/featured_items all
--      cascade, so they go with it.
--
-- WHY ONE FUNCTION FOR BOTH PATHS
--
-- Staff authenticate with a PIN token, not a Supabase session, so they cannot be
-- authorised by owns_customer_shop() -- that reads auth.uid(). Two functions
-- meant two copies of the delete logic to keep in step. p_token is nullable and
-- the branch picks the check that matches the caller, so the deletion itself is
-- written once.
--
-- Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The function
--
-- SECURITY DEFINER because the owner path has to touch customer_cart_items and
-- substitute_for, and the shop account is not granted delete on those. The
-- ownership check below is what makes that safe: it runs as the definer, so it
-- has to do the authorisation itself rather than relying on RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_product_permanently(
  p_product_id uuid,
  p_token      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_shop uuid;
  v_product_name text;
  v_shop_id      uuid;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product is required';
  END IF;

  SELECT shop_id, name
  INTO v_product_shop, v_product_name
  FROM public.customer_products
  WHERE id = p_product_id;

  IF v_product_shop IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Authorisation. Exactly one of these two branches runs, chosen by whether a
  -- staff token was supplied -- not by which check happens to pass, so a caller
  -- cannot fall through to the weaker one.
  IF p_token IS NOT NULL THEN
    SELECT r.shop_id
    INTO v_shop_id
    FROM public.resolve_staff_session(p_token) r;

    IF v_shop_id IS NULL THEN
      RAISE EXCEPTION 'Staff session is invalid or expired';
    END IF;

    IF v_product_shop <> v_shop_id THEN
      RAISE EXCEPTION 'This product belongs to another shop';
    END IF;

  ELSIF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to manage your listings';

  ELSIF NOT (
    (SELECT public.owns_customer_shop(v_product_shop))
    OR (SELECT public.is_admin())
  ) THEN
    RAISE EXCEPTION 'This product belongs to another shop';
  END IF;

  -- Refuse rather than destroy. The order row keeps product_name and unit_price_lkr
  -- denormalised, so deleting the product would leave history that reads correctly
  -- but can no longer be traced back to a listing, and nulling product_id would
  -- lose the link for good. Neither is worth a mis-click, so the shop is told the
  -- product was sold and can archive it instead.
  IF EXISTS (
    SELECT 1 FROM public.customer_order_items
    WHERE product_id = p_product_id
  ) THEN
    RAISE EXCEPTION
      '% has been ordered before and cannot be deleted. Archive it instead to hide it from customers.',
      v_product_name;
  END IF;

  -- Basket lines. These are live data, not history, so they go rather than block:
  -- a deleted product sitting in someone's cart is a cart that cannot be checked
  -- out and cannot be emptied line by line.
  DELETE FROM public.customer_cart_items
  WHERE product_id = p_product_id;

  -- Any product offered as a substitute for this one. The swap is meaningless once
  -- the thing it substitutes for is gone, and keeping the pointer would make
  -- loadCatalog offer a dead listing.
  --
  -- update rather than delete: the substitute is still a real product the shop
  -- stocks, it simply has nothing left to stand in for.
  UPDATE public.customer_products
  SET substitute_for = NULL
  WHERE substitute_for = p_product_id;

  -- shop_inventory, reviews, favourites and featured_items all cascade from here.
  DELETE FROM public.customer_products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
END;
$$;

REVOKE ALL
ON FUNCTION public.delete_product_permanently(uuid, text)
FROM PUBLIC;

-- anon is included because the shop screens hold a PIN token and execute as the
-- anon role with the publishable key. The token check inside is what authorises
-- them; without execute the staff Delete button would fail with 42501 instead.
GRANT EXECUTE
ON FUNCTION public.delete_product_permanently(uuid, text)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Privileges are not in the schema cache
--
-- A newly created function is invisible to PostgREST until it reloads, which
-- shows up as PGRST202 "could not find the function" rather than anything that
-- names the real cause.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';


-- =============================================================================
-- VERIFY
--
-- staff_delete_product is deliberately NOT replaced here. The archive function
-- stays for a product that has to be hidden but kept, and both buttons now mean
-- different things.
-- =============================================================================

-- Must appear with a text p_token and anon_can_execute = t.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                     as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'delete_product_permanently';

-- How many listings can actually be deleted. Anything in "ordered" cannot, and
-- that count is expected to grow as the shop trades rather than being a fault.
select count(*) filter (where not ordered) as deletable,
       count(*) filter (where ordered)     as ordered_keep_archived
  from (
    select p.id,
           exists (select 1 from public.customer_order_items oi
                    where oi.product_id = p.id) as ordered
      from public.customer_products p
  ) t;

-- A dry run of the refusal: pick an ordered product and confirm the message.
-- Returns zero rows when the project has no orders yet, which is fine.
select p.name,
       (select count(*) from public.customer_order_items oi
         where oi.product_id = p.id) as order_lines
  from public.customer_products p
 where exists (select 1 from public.customer_order_items oi
                where oi.product_id = p.id)
 order by order_lines desc
 limit 5;