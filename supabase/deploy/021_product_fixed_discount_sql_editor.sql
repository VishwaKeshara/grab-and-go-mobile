-- ============================================================================
--  RUN THIS WHOLE FILE IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Same content as supabase/migrations/021_product_fixed_discount.sql, for
--  pasting into the dashboard instead of running apply-migrations.ps1.
--  Safe to run more than once (every statement is ADD/DROP IF EXISTS, and the
--  backfill only touches rows that have no type yet).
--
--  Requires 019_product_discount_percent.sql to have been applied first --
--  this file drops and recreates staff_update_product, which 019 also defines.
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
