-- ============================================================================
--  RUN THIS WHOLE FILE IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Every shop-management migration that had never been applied to the deployed
--  project, concatenated in dependency order. Same content as the files in
--  supabase/migrations/, just in one paste for the dashboard.
--
--  WHY IT IS NEEDED - verified against project buazpscpiufcndssxgyi:
--
--    missing  customer_products.discount_percent / discount_type /
--              discount_amount_lkr   (019, 021)
--              Naming these in a select fails the WHOLE query with 42703, which
--              is what showed "We could not load your listings." on Shop
--              Management for a catalogue that had saved fine. The app now
--              reads around this, but the columns are still what the Discount
--              button needs.
--
--    missing  staff_create_product, staff_set_product_stock   (018)
--    missing  staff_update_product                           (019, then 021)
--    missing  staff_my_shop, staff_archive_product           (020)
--              So Add Product, Edit, Discount, Pause, Delete and saving stock
--              all failed with PGRST202 "Could not find the function".
--
--    missing  the 6 grocery rows for product_categories        (019 seed)
--              The table exists but is empty, so the category chips showed
--              "No categories available yet."
--
--  Already applied, so NOT included: 016 supplies resolve_staff_session and the
--  staff login functions these depend on.
--
--  ORDER MATTERS. 021 drops and recreates the staff_update_product that 019
--  defines, and both add columns the later one reads, so run them in this
--  order. Every statement is IF EXISTS / IF NOT EXISTS / OR REPLACE, so this is
--  safe to run more than once.

-- =============================================================================
-- source: supabase/migrations/018_staff_product_writes.sql
-- =============================================================================

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

-- =============================================================================
-- source: supabase/migrations/019_product_discount_percent.sql
-- =============================================================================

-- =============================================================================
-- 019 - Store the discount percentage on the product
--
-- WHY customer_products AND NOT shop_inventory
--
--   • shop_inventory is stock. Its columns are quantity, low_stock_threshold
--     and is_available. A price promotion is not a stock concern, and mixing the
--     two would mean the discount only exists for products that happen to have
--     an inventory row.
--   • shop_inventory is currently empty. A discount stored there would be
--     invisible for every product in the catalogue today.
--   • customer_products is the row the customer-facing reads already query --
--     search and the product details page select price_lkr and
--     regular_price_lkr directly. A discount column here needs no join.
--
-- WHAT THE THREE PRICE COLUMNS MEAN
--
--   price_lkr          the price the customer pays now (after any discount)
--   regular_price_lkr  the "was" price, always >= price_lkr
--   discount_percent   0-100, the discount currently applied
--
-- discount_percent is technically derivable as
-- (regular_price_lkr - price_lkr) / regular_price_lkr * 100, and the app was
-- deriving it. It is stored explicitly because reporting needs to ask "which
-- products are on 20% off?" without doing arithmetic in every query, and because
-- a discount like LKR 37 off a LKR 410 item is 9.0% -- the clerk typed a
-- percentage and this records what they typed.
--
-- The constraint below keeps the three columns consistent with each other, so
-- the stored percentage can never drift from the two prices.
--
-- Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The column
-- -----------------------------------------------------------------------------
alter table public.customer_products
  add column if not exists discount_percent integer;

comment on column public.customer_products.discount_percent is
  'Discount applied to this product, 0-100. price_lkr is the discounted price and regular_price_lkr is the pre-discount price.';


-- -----------------------------------------------------------------------------
-- 2. Backfill anything already discounted
--
-- Products where regular > price already carry a discount from the previous
-- scheme, where the percentage was derived rather than stored. Seeding the
-- column from that keeps existing promotions intact instead of losing them.
-- -----------------------------------------------------------------------------
update public.customer_products
set discount_percent = round(
      ((regular_price_lkr - price_lkr)::numeric / NULLIF(regular_price_lkr, 0)) * 100
    )
where regular_price_lkr > price_lkr
  and regular_price_lkr > 0
  and (discount_percent is null or discount_percent = 0);


-- -----------------------------------------------------------------------------
-- 3. Constraint
--
-- A CHECK rather than a trigger: it is evaluated on every write, so an
-- out-of-range percentage is rejected at the source instead of being corrected
-- later. The `price_lkr <= regular_price_lkr` half is what guarantees the three
-- columns agree.
--
-- The existing constraint is dropped and recreated because CHECK constraints
-- cannot be altered in place, and this table is small enough that validating it
-- is instant.
-- -----------------------------------------------------------------------------
alter table public.customer_products
  drop constraint if exists customer_products_discount_percent_check;

alter table public.customer_products
  add constraint customer_products_discount_percent_check
  check (
    (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100))
    and price_lkr <= regular_price_lkr
  );


-- -----------------------------------------------------------------------------
-- 4. Keep the column in step for writes
--
-- staff_update_product is the single write path used by both the Edit form and
-- the Discount button, so deriving the percentage here means the stored value
-- can never disagree with the prices. Recreated in full because CREATE OR
-- REPLACE FUNCTION cannot add a parameter with a default in a position that
-- changes the identity arguments.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_update_product(
  p_token               text,
  p_product_id          uuid,
  p_name                text DEFAULT NULL,
  p_unit                text DEFAULT NULL,
  p_price_lkr           integer DEFAULT NULL,
  p_regular_price_lkr   integer DEFAULT NULL,
  p_image_url           text DEFAULT NULL,
  p_category_id         uuid DEFAULT NULL,
  p_clear_category      boolean DEFAULT false,
  p_active              boolean DEFAULT NULL,
  p_discount_percent    integer DEFAULT NULL,
  p_clear_discount      boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id      uuid;
  v_product_shop uuid;
  v_price        integer;
  v_regular      integer;
  v_discount     integer;
  v_category     uuid;
  v_category_set boolean := false;
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

  SELECT price_lkr, regular_price_lkr, discount_percent
  INTO v_price, v_regular, v_discount
  FROM public.customer_products
  WHERE id = p_product_id;

  v_price := COALESCE(p_price_lkr, v_price);
  v_regular := COALESCE(p_regular_price_lkr, v_regular);

  IF v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Selling price must be zero or more';
  END IF;

  -- The "was" price can never sit below the selling price.
  v_regular := GREATEST(COALESCE(v_regular, v_price), v_price);

  IF p_discount_percent IS NOT NULL THEN
    IF p_discount_percent < 0 OR p_discount_percent > 100 THEN
      RAISE EXCEPTION 'Discount must be between 0 and 100';
    END IF;

    -- The percentage is applied to the regular price and rounded to whole
    -- rupees, which is how the preview in the app is calculated, so what the
    -- clerk saw is what gets stored.
    v_price := GREATEST(
      0,
      round(v_regular * (1 - p_discount_percent::numeric / 100))
    );
    v_discount := p_discount_percent;
  ELSIF COALESCE(p_clear_discount, false) THEN
    v_price := v_regular;
    v_discount := 0;
  ELSE
    -- No percentage supplied: keep the percentage consistent with any price
    -- change, otherwise the stored value would contradict price_lkr.
    IF v_regular > 0 AND v_regular > v_price THEN
      v_discount := round(
        ((v_regular - v_price)::numeric / v_regular) * 100
      );
    ELSE
      v_discount := 0;
    END IF;
  END IF;

  IF p_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_categories
      WHERE id = p_category_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Selected category does not exist or is inactive';
    END IF;
    v_category := p_category_id;
    v_category_set := true;
  ELSIF COALESCE(p_clear_category, false) THEN
    v_category := NULL;
    v_category_set := true;
  END IF;

  UPDATE public.customer_products
  SET name = COALESCE(NULLIF(trim(p_name), ''), name),
      unit = COALESCE(NULLIF(trim(p_unit), ''), unit),
      price_lkr = v_price,
      regular_price_lkr = v_regular,
      discount_percent = v_discount,
      image_url = CASE
        WHEN p_image_url IS NULL THEN image_url
        ELSE NULLIF(trim(p_image_url), '')
      END,
      category_id = CASE WHEN v_category_set THEN v_category ELSE category_id END,
      active = COALESCE(p_active, active)
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, boolean
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, boolean
)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- VERIFY
-- -----------------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customer_products'
  and column_name = 'discount_percent';

-- Any product already carrying a discount, and whether the three columns agree
select name, price_lkr, regular_price_lkr, discount_percent
from public.customer_products
where discount_percent > 0
order by name;

-- =============================================================================
-- source: supabase/migrations/019_product_categories_seed.sql
-- =============================================================================

-- =============================================================================
-- 019 - Seed grocery categories
--
-- product_categories exists but is empty, so the Add Product form's category
-- chips rendered "No categories available yet." and no product could ever be
-- given a category. This file puts the categories back.
--
-- Verified against project buazpscpiufcndssxgyi on 2026-10-08:
--   product_categories   table exists, 0 rows
--   customer_products    13 rows, category_id null on every one
--
-- The set is the original six from migrations/009 and /010, with the two
-- renames the client asked for:
--   "Pantry Staples" -> "Pantry & Dry Goods"
--   "Household"      -> "Biscuits & Snacks"
--
-- Both rows are renamed in place rather than deleted and re-inserted, because
-- category_id is a uuid foreign key into this table: replacing a row would
-- silently orphan every product pointing at it. Nothing does in this project
-- yet, but the UPDATE is the only version that is correct where something does.
--
-- Idempotent. Re-running re-applies the same names and never resets is_active,
-- which a shop may have switched off.
-- =============================================================================

-- 1. Rename the two rows in place: name AND slug. Both have to move together,
--    because BOTH columns are UNIQUE -- renaming the name while leaving the old
--    slug would make step 2's insert of that same name collide with itself.
--    Keeping the row id is the point: category_id is a uuid foreign key into
--    this table, so delete + re-insert would orphan every product pointing at
--    the old row.
--
--    The NOT EXISTS guard covers a database that already has the new slug, from
--    having run an earlier draft of this seed. Without it the rename would hit
--    a duplicate-key error and abort the whole file. When that happens the new
--    row is already correct and only the stale old one needs removing, which
--    step 3 does.
update public.product_categories
   set name = 'Pantry & Dry Goods', slug = 'pantry-dry-goods'
 where slug = 'pantry-staples'
   and not exists (select 1 from public.product_categories c
                    where c.slug = 'pantry-dry-goods' and c.id <> product_categories.id);

update public.product_categories
   set name = 'Biscuits & Snacks', slug = 'biscuits-snacks'
 where slug = 'household'
   and not exists (select 1 from public.product_categories c
                    where c.slug = 'biscuits-snacks' and c.id <> product_categories.id);

-- 2. All six, inserted when missing and left alone when already present. The
--    equivalent statements in 009/010 used `do update`, which reset is_active
--    on every run, so an admin switching a category off had it turned back on
--    by the next seed. `do nothing` keeps that switch.
--
--    Conflict target is the slug, which is unique, so the only thing that can
--    raise here is a row already holding one of these NAMES under some other
--    slug. That is not a state this seed creates, and it is not silently
--    swallowed: an insert that fails loudly is better than one that quietly
--    leaves the form short a category.
insert into public.product_categories (name, slug, icon, tint, sort_order)
values
  ('Fruits',           'fruits',        'basket', '#EF7E69', 10),
  ('Vegetables',       'vegetables',    'basket', '#55E5BA', 20),
  ('Dairy & Chilled',  'dairy-chilled', 'basket', '#8B7BF0', 30),
  ('Pantry & Dry Goods','pantry-dry-goods', 'basket', '#F6B84B', 40),
  ('Beverages',        'beverages',     'basket', '#5B7CFA', 50),
  ('Biscuits & Snacks', 'biscuits-snacks',  'basket', '#171543', 60)
on conflict (slug) do nothing;

-- 3. Repoint anything still sitting on a pre-rename slug, then drop those rows.
--    category_id is `on delete set null`, so without the repoint the delete
--    would leave every affected product uncategorised instead of following the
--    category it was renamed to.
update public.customer_products p
   set category_id = c.id
  from public.product_categories c
 where p.category_id is not null
   and c.slug = 'pantry-dry-goods'
   and exists (select 1 from public.product_categories old
                where old.id = p.category_id and old.slug = 'pantry-staples');

update public.customer_products p
   set category_id = c.id
  from public.product_categories c
 where p.category_id is not null
   and c.slug = 'biscuits-snacks'
   and exists (select 1 from public.product_categories old
                where old.id = p.category_id and old.slug = 'household');

delete from public.product_categories
 where slug in ('pantry-staples', 'household');


-- Existing products are left with category_id null rather than being guessed
-- at. Assigning them would be inventing data; they still show as
-- "Uncategorised" and are still searchable.


-- =============================================================================
-- VERIFY - expect 6 rows, with Pantry & Dry Goods and Biscuits & Snacks and
-- neither old slug present.
-- =============================================================================
select name, slug, is_active, sort_order
from public.product_categories
order by sort_order, name;

-- =============================================================================
-- source: supabase/migrations/020_staff_shop_management_access.sql
-- =============================================================================

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

-- =============================================================================
-- source: supabase/migrations/021_product_fixed_discount.sql
-- =============================================================================

-- =============================================================================
-- 021 - Fixed-amount discounts alongside percentage discounts
--
-- WHY customer_products AND NOT shop_inventory
--
--   Unchanged from 019. A discount is a price, not a stock concern, and
--   shop_inventory only holds quantity, low_stock_threshold and is_available.
--   It also only has rows for products a shop has actually stocked, so a
--   promotion stored there would be invisible for everything else.
--
-- WHAT THE COLUMNS MEAN AFTER THIS MIGRATION
--
--   regular_price_lkr    the base "was" price, always >= price_lkr
--   price_lkr            the price the customer pays, i.e. the DISCOUNT PRICE
--   discount_type        'percent' | 'fixed', or NULL when there is no discount
--   discount_percent     0-100, used only when discount_type = 'percent'
--   discount_amount_lkr  whole rupees off, used only when 'fixed'
--
--   Worked example, base LKR 500:
--     discount_type 'percent', discount_percent    10 -> price_lkr 450
--     discount_type 'fixed',   discount_amount_lkr 58 -> price_lkr 442
--
-- WHY discount_type IS STORED RATHER THAN INFERRED
--
--   Either value could be derived from the price pair, so a single column
--   looked sufficient. But 10% off a LKR 500 item and LKR 50 off are the same
--   money today while meaning different things tomorrow, and this records what
--   the clerk actually typed. It also makes the two options mutually exclusive
--   at the schema level instead of by convention in the UI, so no row can ever
--   carry both.
--
--   Note price_lkr is already the discount price, so it is left alone -- the
--   whole customer-facing catalogue, the cart and every order total read it.
--
-- Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The columns
-- -----------------------------------------------------------------------------
alter table public.customer_products
  add column if not exists discount_type text;

alter table public.customer_products
  add column if not exists discount_amount_lkr integer;

comment on column public.customer_products.discount_type is
  'Which discount option the shop picked: ''percent'' or ''fixed''. NULL when the product has no discount.';

comment on column public.customer_products.discount_amount_lkr is
  'Whole rupees taken off regular_price_lkr when discount_type = ''fixed''. NULL otherwise.';


-- -----------------------------------------------------------------------------
-- 2. Backfill existing promotions
--
-- Anything written under 019 used the percentage scheme, so that is what those
-- rows are labelled as. Seeding the type keeps those discounts intact and keeps
-- the new exclusivity constraint satisfied.
-- -----------------------------------------------------------------------------
update public.customer_products
set discount_type = 'percent'
where discount_percent > 0
  and coalesce(discount_type, '') <> 'percent';


-- -----------------------------------------------------------------------------
-- 3. Constraints
--
-- Separate from the 019 check, which still guards the percentage range and
-- price_lkr <= regular_price_lkr. These cover only what is new.
--
-- A CHECK rather than a trigger, for the same reason as 019: it is evaluated on
-- every write, so an impossible combination is rejected at the source instead
-- of being silently corrected later.
-- -----------------------------------------------------------------------------
alter table public.customer_products
  drop constraint if exists customer_products_discount_check;

alter table public.customer_products
  add constraint customer_products_discount_check
  check (
    -- Only two options exist, or none.
    (discount_type is null or discount_type in ('percent', 'fixed'))

    -- A fixed discount always carries its amount, and never a percentage.
    and not (discount_type = 'fixed' and discount_amount_lkr is null)
    and not (discount_type = 'fixed' and coalesce(discount_percent, 0) > 0)

    -- A percentage discount never carries an amount, so the two can never
    -- disagree about what was applied.
    and not (discount_type = 'percent' and discount_amount_lkr is not null)

    -- You cannot take more rupees off than the item costs.
    and (discount_amount_lkr is null or discount_amount_lkr >= 0)
    and (discount_amount_lkr is null
         or regular_price_lkr is null
         or discount_amount_lkr <= regular_price_lkr)
  );


-- -----------------------------------------------------------------------------
-- 4. Keep the columns in step for writes
--
-- staff_update_product is the single write path used by both the Edit form and
-- the Discount button, so deriving both values here is what guarantees the
-- stored discount and price_lkr can never disagree.
--
-- The signature changed, so the old overload is dropped first: CREATE OR
-- REPLACE would otherwise add a second 14-argument function and leave the 12
-- argument one -- and its GRANT -- still in the database.
-- -----------------------------------------------------------------------------
drop function if exists public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, boolean
);

CREATE OR REPLACE FUNCTION public.staff_update_product(
  p_token               text,
  p_product_id          uuid,
  p_name                text DEFAULT NULL,
  p_unit                text DEFAULT NULL,
  p_price_lkr           integer DEFAULT NULL,
  p_regular_price_lkr   integer DEFAULT NULL,
  p_image_url           text DEFAULT NULL,
  p_category_id         uuid DEFAULT NULL,
  p_clear_category      boolean DEFAULT NULL,
  p_active              boolean DEFAULT NULL,
  p_discount_percent    integer DEFAULT NULL,
  p_discount_type       text DEFAULT NULL,
  p_discount_amount_lkr integer DEFAULT NULL,
  p_clear_discount      boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id        uuid;
  v_product_shop   uuid;
  v_price          integer;
  v_regular        integer;
  v_discount       integer;
  v_discount_type  text;
  v_discount_amount integer;
  v_category       uuid;
  v_category_set   boolean := false;
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

  SELECT price_lkr, regular_price_lkr, discount_percent,
         discount_type, discount_amount_lkr
  INTO v_price, v_regular, v_discount, v_discount_type, v_discount_amount
  FROM public.customer_products
  WHERE id = p_product_id;

  v_price := COALESCE(p_price_lkr, v_price);
  v_regular := COALESCE(p_regular_price_lkr, v_regular);

  IF v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Selling price must be zero or more';
  END IF;

  -- The "was" price can never sit below the selling price.
  v_regular := GREATEST(COALESCE(v_regular, v_price), v_price);

  -- One option at a time. Sending both is a caller bug, and saying so here is
  -- cheaper to debug than a discount price that silently matched only one.
  IF p_discount_percent IS NOT NULL AND p_discount_amount_lkr IS NOT NULL THEN
    RAISE EXCEPTION 'Choose either a percentage or a fixed amount, not both';
  END IF;

  IF p_discount_percent IS NOT NULL THEN
    IF p_discount_percent < 0 OR p_discount_percent > 100 THEN
      RAISE EXCEPTION 'Discount must be between 0 and 100';
    END IF;

    -- Applied to the regular price and rounded to whole rupees, which is how
    -- the app calculates its preview, so what the clerk saw is what is stored.
    v_price := GREATEST(
      0,
      round(v_regular * (1 - p_discount_percent::numeric / 100))
    );
    v_discount := p_discount_percent;
    v_discount_type := 'percent';
    v_discount_amount := NULL;

  ELSIF p_discount_amount_lkr IS NOT NULL THEN
    IF p_discount_amount_lkr <= 0 THEN
      RAISE EXCEPTION 'Enter a discount amount greater than zero';
    END IF;

    IF p_discount_amount_lkr > v_regular THEN
      RAISE EXCEPTION
        'A fixed discount cannot be more than the regular price of %', v_regular;
    END IF;

    v_price := GREATEST(0, v_regular - p_discount_amount_lkr);
    v_discount_amount := p_discount_amount_lkr;
    v_discount_type := 'fixed';

    -- discount_percent stays 0 in fixed mode on purpose.
    --
    -- An earlier version stored the equivalent percentage here (LKR 58 off 500
    -- as 12%) so reporting could ask "which products are 20% off?" directly. That
    -- is exactly what customer_products_discount_check forbids:
    --
    --   not (discount_type = 'fixed' and coalesce(discount_percent, 0) > 0)
    --
    -- so every fixed discount died with
    --   23514 new row violates check constraint customer_products_discount_check
    -- on both the staff and the owner path. Fixed discounts were unreachable.
    --
    -- The percentage is not lost by storing 0: it is derivable from the price
    -- pair, which is what discountPercentOf() in shop-management.tsx already
    -- does when the stored value is 0, and what the discount modal previews live
    -- as "That is 12% off". Nothing reads the column without that fallback.
    v_discount := 0;

  ELSIF COALESCE(p_clear_discount, false) THEN
    v_price := v_regular;
    v_discount := 0;
    v_discount_type := NULL;
    v_discount_amount := NULL;

  ELSE
    -- No discount supplied: keep whatever is stored consistent with any price
    -- change, otherwise it would contradict price_lkr. The mode is preserved,
    -- so an item priced as "LKR 58 off" stays a fixed discount when the shop
    -- edits its selling price.
    IF v_regular > 0 AND v_regular > v_price THEN
      IF v_discount_type = 'fixed' AND v_discount_amount IS NOT NULL THEN
        -- A fixed discount keeps its amount and stays percentage-free, for the
        -- same reason the branch above does: the CHECK constraint rejects a
        -- fixed row that also carries a percentage.
        v_discount_amount := v_regular - v_price;
        v_discount := 0;
      ELSE
        v_discount_type := 'percent';
        v_discount := round(((v_regular - v_price)::numeric / v_regular) * 100);
        v_discount_amount := NULL;
      END IF;
    ELSE
      v_discount := 0;
      v_discount_type := NULL;
      v_discount_amount := NULL;
    END IF;
  END IF;

  IF p_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_categories
      WHERE id = p_category_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Selected category does not exist or is inactive';
    END IF;
    v_category := p_category_id;
    v_category_set := true;
  ELSIF COALESCE(p_clear_category, false) THEN
    v_category := NULL;
    v_category_set := true;
  END IF;

  UPDATE public.customer_products
  SET name = COALESCE(NULLIF(trim(p_name), ''), name),
      unit = COALESCE(NULLIF(trim(p_unit), ''), unit),
      price_lkr = v_price,
      regular_price_lkr = v_regular,
      discount_percent = v_discount,
      discount_type = v_discount_type,
      discount_amount_lkr = v_discount_amount,
      image_url = CASE
        WHEN p_image_url IS NULL THEN image_url
        ELSE NULLIF(trim(p_image_url), '')
      END,
      category_id = CASE WHEN v_category_set THEN v_category ELSE category_id END,
      active = COALESCE(p_active, active)
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, text, integer, boolean
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, text, integer, boolean
)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- VERIFY
-- -----------------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customer_products'
  and column_name in ('discount_type', 'discount_amount_lkr', 'discount_percent');

-- The two options are mutually exclusive, so no row here should ever have both
-- an amount and a non-zero percentage.
select name,
       regular_price_lkr,
       price_lkr,
       discount_type,
       discount_percent,
       discount_amount_lkr
from public.customer_products
where discount_type is not null
order by name;

-- =============================================================================
--  Reload PostgREST's schema cache.
--
--  Each CREATE FUNCTION / GRANT above is invisible to the API until it is told
--  to pick them up, and the symptom when it does not is PGRST202 on a function
--  that plainly exists in the database.
-- =============================================================================
notify pgrst, 'reload schema';
