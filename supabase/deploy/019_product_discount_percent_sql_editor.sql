-- ============================================================================
--  RUN THIS FIRST, IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Same content as supabase/migrations/019_product_discount_percent.sql, for
--  pasting into the dashboard instead of running apply-migrations.ps1.
--
--  This is what creates staff_update_product, the RPC the Edit and Discount
--  buttons in the app call. Without it neither button can work.
--  Run 019_product_discount_percent_sql_editor.sql BEFORE
--  021_product_fixed_discount_sql_editor.sql -- 021 drops and recreates the
--  same function with two extra parameters.
--
--  Safe to run more than once (all statements are ADD/DROP IF EXISTS).
-- ============================================================================

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
