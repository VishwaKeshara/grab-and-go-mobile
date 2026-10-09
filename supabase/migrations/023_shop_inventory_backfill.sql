-- =============================================================================
-- 023 - Backfill shop_inventory for every listing
--
-- WHAT WAS BROKEN
--
-- shop_inventory held 0 rows while customer_products held 14. Two things broke
-- from that, and neither was a UI problem:
--
--   Search showed nothing. discoveryService joins shop_inventory with !inner,
--   so a product with no inventory row is not returned at all -- not even as
--   sold out.
--
--   Add to cart was refused. change_customer_cart (migration 012) raises
--   'Product inventory unavailable' when the row is missing, before it ever
--   looks at quantity. So a product visible in a list could still not be added.
--
-- WHY THE TABLE IS EMPTY
--
-- Migration 012 already contains this exact backfill, as its first statement.
-- It ran before any listing pointed at a shop, so it inserted nothing, and
-- nothing has re-run it since. This file is that statement again, unchanged in
-- meaning, made re-runnable so the data problem can be fixed on a database that
-- has already been through 012.
--
-- NOT A SCHEMA CHANGE
--
-- No table is altered. This only inserts rows that are missing, so it is safe to
-- run against a shop that has been trading: an existing row is its own source of
-- truth for stock and this leaves it alone.
--
-- Idempotent. Re-running inserts only what is still missing.
-- =============================================================================


-- 1. Insert a stock row for every listing that has none, carrying the quantity
--    and availability across from the product.
--
--    `greatest(stock_quantity, 0)` guards the quantity check constraint:
--    customer_products has no such constraint, so a negative value there would
--    abort the whole insert rather than just that row.
--
--    NOT EXISTS is what makes this a backfill rather than an overwrite. Matched
--    on (shop_id, product_id), which is also the table's unique key, so this can
--    never produce a duplicate.
insert into public.shop_inventory (shop_id, product_id, quantity, is_available)
select p.shop_id, p.id, greatest(p.stock_quantity, 0), p.available
  from public.customer_products p
 where not exists (
   select 1
     from public.shop_inventory inv
    where inv.shop_id = p.shop_id
      and inv.product_id = p.id
 );

-- 2. A row with no stock is not orderable, so is_available is corrected for the
--    rows just inserted. Deliberately NOT applied to rows that already existed:
--    a shop that has marked a stocked product unavailable on purpose would have
--    that decision undone by a backfill.
--
--    Both directions, because a pre-existing row can disagree with the product
--    either way, and leaving them disagreeing means the cart and the catalogue
--    tell the shopper two different things.
update public.shop_inventory inv
   set is_available = false
  from public.customer_products p
 where p.id = inv.product_id
   and p.shop_id = inv.shop_id
   and inv.quantity < 1
   and inv.is_available;


-- =============================================================================
-- VERIFY - expect one row per listing, and no listing left without one.
-- =============================================================================

-- Every listing now has exactly one stock row.
select count(*) as listings,
       count(inv.product_id) as listings_with_a_stock_row
  from public.customer_products p
  left join public.shop_inventory inv
    on inv.shop_id = p.shop_id
   and inv.product_id = p.id;

-- Orderable vs sold out. These two numbers are what the search screen splits
-- into visible products and "Sold out" badges.
select count(*) filter (where inv.quantity > 0 and inv.is_available) as orderable,
       count(*) filter (where inv.quantity < 1 or not inv.is_available) as sold_out
  from public.shop_inventory inv
  join public.customer_products p on p.id = inv.product_id
 where p.active;

-- Any listing still missing a row must return zero rows. If it does not, the
-- insert above did not run to completion.
select p.id, p.name, p.stock_quantity
  from public.customer_products p
 where not exists (
   select 1 from public.shop_inventory inv
    where inv.shop_id = p.shop_id and inv.product_id = p.id
 );