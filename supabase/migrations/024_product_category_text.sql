-- =============================================================================
-- 024 - Category becomes free text on customer_products
--
-- WHAT CHANGES
--
--   customer_products.category_id  uuid FK -> product_categories(id)   REMOVED
--   customer_products.category      text, e.g. 'Vegetables', 'Fruits'   ADDED
--   product_categories              the reference table                DROPPED
--
-- WHY
--
--   The category was only ever a label. Nothing joins on it, nothing counts
--   across shops on it, and a shop adding "Carrots" should not have to wait for
--   a catalogue row to exist. Storing the label directly removes the picker
--   table, the embed in every catalogue read, and the validation query in both
--   staff RPCs.
--
--   The cost is real and is accepted knowingly: there is no longer a single
--   place to rename a category, so "Vegetables" and "vegetables" are two
--   categories. Every read here and in the app therefore matches case
--   insensitively (lower(category) index, ilike filters) rather than exactly,
--   so the two still land on the same rail tile and the same product list.
--
-- ORDER MATTERS IN THIS FILE
--
--   1. add the column
--   2. backfill it from the old FK  <- must happen while both exist
--   3. rebuild the two staff RPCs   <- must happen before the column they write
--   4. drop category_id
--   5. drop product_categories
--
-- Safe to re-run. Every step is `if exists` / `if not exists` guarded, and the
-- backfill is guarded on the old table still being present, so running this on a
-- database where it already ran is a no-op rather than an error.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The column
-- -----------------------------------------------------------------------------
alter table public.customer_products
  add column if not exists category text;

comment on column public.customer_products.category is
  'Free-text category label the shop picked when adding the product, e.g. ''Vegetables''. NULL when uncategorised. Replaces the former category_id foreign key.';


-- -----------------------------------------------------------------------------
-- 2. Backfill from the old foreign key
--
-- The name is copied, not the id: the id has nowhere left to point once
-- product_categories is gone in step 5. Products left uncategorised under the
-- old scheme stay uncategorised rather than being guessed at.
--
-- Guarded because on a second run product_categories no longer exists and the
-- subquery would raise 42P01.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.product_categories') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'customer_products'
         and column_name = 'category_id'
     )
  then
    update public.customer_products p
       set category = c.name
      from public.product_categories c
     where c.id = p.category_id
       and coalesce(p.category, '') = '';
  end if;
end;
$$;

-- Grouping and the rail's count both happen on the folded value, because the
-- backfill above copies names verbatim and two shops can disagree on case.
create index if not exists customer_products_category_lower_idx
  on public.customer_products (lower(category))
  where category is not null;


-- -----------------------------------------------------------------------------
-- 3. staff_create_product -- p_category_id uuid becomes p_category text
--
-- Dropped before recreation because the argument type changed: CREATE OR
-- REPLACE cannot alter an existing signature, so the uuid overload would be
-- left behind alongside the text one and PostgREST would refuse the call as
-- ambiguous.
--
-- The "does this category exist" check is gone with the table. In its place a
-- length cap, so a label cannot become a paragraph: customer_products.category
-- is read straight into a browse rail tile and a search filter.
-- -----------------------------------------------------------------------------
drop function if exists public.staff_create_product(text, text, text, integer, text, integer, uuid);

CREATE OR REPLACE FUNCTION public.staff_create_product(
  p_token             text,
  p_name              text,
  p_unit              text,
  p_price_lkr         integer,
  p_image_url         text,
  p_initial_quantity  integer,
  p_category          text DEFAULT NULL
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
  v_category  text;
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

  -- An empty or whitespace-only selection is "no category", not a category that
  -- happens to be blank. The same rule runs on the owner path in the app, but
  -- this is the path a PIN-holding clerk uses, so it is enforced here too.
  v_category := NULLIF(btrim(COALESCE(p_category, '')), '');

  IF v_category IS NOT NULL AND length(v_category) > 60 THEN
    RAISE EXCEPTION 'Category must be 60 characters or fewer';
  END IF;

  INSERT INTO public.customer_products (
    shop_id, name, unit, price_lkr, regular_price_lkr, image_url,
    active, available, stock_quantity, category
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
ON FUNCTION public.staff_create_product(text, text, text, integer, text, integer, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_create_product(text, text, text, integer, text, integer, text)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. staff_update_product -- same signature change
--
-- The 12-argument overload from 019 is dropped as well. 021 already removed it,
-- but a project that applied 019 and skipped 021 would still have it, and two
-- live overloads make every call ambiguous.
--
-- Everything else in this function -- the discount arithmetic from 021 -- is
-- carried over untouched. Only the category pair changed.
-- -----------------------------------------------------------------------------
drop function if exists public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, boolean
);

drop function if exists public.staff_update_product(
  text, uuid, text, text, integer, integer, text, uuid, boolean, boolean,
  integer, text, integer, boolean
);

CREATE OR REPLACE FUNCTION public.staff_update_product(
  p_token               text,
  p_product_id          uuid,
  p_name                text,
  p_unit                text,
  p_price_lkr           integer,
  p_regular_price_lkr   integer,
  p_image_url           text,
  p_category            text,
  p_clear_category      boolean,
  p_active              boolean,
  p_discount_percent    integer,
  p_discount_type       text,
  p_discount_amount_lkr integer,
  p_clear_discount      boolean
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
  v_category       text;
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

    -- discount_percent stays 0 in fixed mode on purpose: the
    -- customer_products_discount_check constraint from 021 forbids a fixed row
    -- that also carries a percentage, and the percentage is derivable from the
    -- price pair regardless.
    v_discount := 0;

  ELSIF COALESCE(p_clear_discount, false) THEN
    v_price := v_regular;
    v_discount := 0;
    v_discount_type := NULL;
    v_discount_amount := NULL;

  ELSE
    -- No discount supplied: keep whatever is stored consistent with any price
    -- change, otherwise it would contradict price_lkr.
    IF v_regular > 0 AND v_regular > v_price THEN
      IF v_discount_type = 'fixed' AND v_discount_amount IS NOT NULL THEN
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

  IF NULLIF(btrim(COALESCE(p_category, '')), '') IS NOT NULL THEN
    v_category := btrim(p_category);

    IF length(v_category) > 60 THEN
      RAISE EXCEPTION 'Category must be 60 characters or fewer';
    END IF;

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
      category = CASE WHEN v_category_set THEN v_category ELSE category END,
      active = COALESCE(p_active, active)
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.staff_update_product(
  text, uuid, text, text, integer, integer, text, text, boolean, boolean,
  integer, text, integer, boolean
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.staff_update_product(
  text, uuid, text, text, integer, integer, text, text, boolean, boolean,
  integer, text, integer, boolean
)
TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Drop the old column
--
-- The index goes with it automatically, but it is named explicitly so a project
-- that renamed it does not fail the DROP COLUMN.
-- -----------------------------------------------------------------------------
drop index if exists public.customer_products_category_idx;

alter table public.customer_products
  drop column if exists category_id;


-- -----------------------------------------------------------------------------
-- 6. Drop product_categories
--
-- customer_products was the only table referencing it (the sole foreign key in
-- migrations 009 and 010), so nothing else blocks the drop. Anything that used
-- to point here now lives in customer_products.category, which step 2 copied.
-- -----------------------------------------------------------------------------
drop table if exists public.product_categories;


-- -----------------------------------------------------------------------------
-- VERIFY
--
-- One row per category the shops have actually used. Nothing here should say
-- Vegetables and vegetables as separate entries once folded.
-- -----------------------------------------------------------------------------
select coalesce(nullif(btrim(category), ''), '(uncategorised)') as category,
       count(*)                                        as listings,
       count(*) filter (where active)                   as live
  from public.customer_products
 group by 1
 order by 3 desc, 2 desc, 1;

-- category_id must be gone from this table, category must be present.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'customer_products'
   and column_name in ('category', 'category_id');

-- Both RPCs must exist with the text signature and be executable by anon,
-- which is what the shop screens authenticate as.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                     as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('staff_create_product', 'staff_update_product')
 order by p.proname, args;