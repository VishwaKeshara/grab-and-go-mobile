-- ============================================================================
--  RUN THIS WHOLE FILE IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Gives every product a shop_inventory row.
--
--  WHY IT IS NEEDED - verified against project buazpscpiufcndssxgyi on
--  2026-10-08:
--
--    customer_products   14 listings
--    shop_inventory      0 rows
--
--  Two things were broken by that, and neither was a screen problem:
--
--    Search returned nothing. The product list joins shop_inventory with
--    !inner, so a listing with no stock row is never returned at all.
--
--    Add to cart was refused. change_customer_cart raises 'Product inventory
--    unavailable' when the row is missing, before it looks at quantity, so a
--    product that appeared in a list still could not be added.
--
--  Migration 012 already contains this same backfill as its first statement. It
--  ran before any listing pointed at a shop, so it inserted nothing, and nothing
--  has re-run it since.
--
--  No schema change. This only inserts rows that are missing, so a shop that is
--  already trading keeps its own stock figures. Safe to run more than once.
-- ============================================================================

-- 1. A stock row for every listing that has none, carrying quantity and
--    availability across from the product.
--
--    greatest(stock_quantity, 0) guards the quantity check constraint:
--    customer_products has no such constraint, so a negative value there would
--    abort the whole insert rather than just that row.
--
--    NOT EXISTS makes this a backfill and not an overwrite. Matched on
--    (shop_id, product_id), which is also the table's unique key, so it cannot
--    produce a duplicate.
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
--    a shop that marked a stocked product unavailable on purpose would have that
--    decision undone by a backfill.
update public.shop_inventory inv
   set is_available = false
  from public.customer_products p
 where p.id = inv.product_id
   and p.shop_id = inv.shop_id
   and inv.quantity < 1
   and inv.is_available;


-- =============================================================================
-- VERIFY - listings_with_a_stock_row must equal listings.
-- =============================================================================
select count(*) as listings,
       count(inv.product_id) as listings_with_a_stock_row
  from public.customer_products p
  left join public.shop_inventory inv
    on inv.shop_id = p.shop_id
   and inv.product_id = p.id;

-- Orderable vs sold out. These are the two groups the search screen splits into
-- visible products and "Sold out" badges.
select count(*) filter (where inv.quantity > 0 and inv.is_available) as orderable,
       count(*) filter (where inv.quantity < 1 or not inv.is_available) as sold_out
  from public.shop_inventory inv
  join public.customer_products p on p.id = inv.product_id
 where p.active;

-- Must return zero rows. If it does not, the insert did not run to completion.
select p.id, p.name, p.stock_quantity
  from public.customer_products p
 where not exists (
   select 1 from public.shop_inventory inv
    where inv.shop_id = p.shop_id and inv.product_id = p.id
 );