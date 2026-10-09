-- ============================================================================
--  RUN THIS WHOLE FILE IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Same content as supabase/migrations/022_owner_shop_writes.sql, for pasting into the dashboard.
--
--  Lets the shop OWNER add and edit products, apply and remove discounts, change
--  stock, pause a listing and archive one -- the same actions a staff PIN
--  already had. Until this is applied the app will tell an owner to "Sign in as
--  shop staff" for their own shop.
--
--  Run it AFTER 018_021_shop_management_sql_editor.sql: the discount columns and
--  the staff functions in that file are what the Discount button and the staff
--  path both rely on.
--
--  Safe to run more than once (enable row level security, drop policy if exists,
--  and grant are all idempotent).
-- ============================================================================

-- =============================================================================
-- 022 - Let the shop owner write to their own shop
--
-- WHAT WAS BROKEN
--
-- Every write on the Shop Management screen was gated on a staff PIN token:
--
--   applyDiscount()  -> "Sign in as shop staff before applying a discount."
--   updateShopProduct(), setProductActive(), createShopProduct(),
--   saveStock(), deleteShopProduct()
--
-- A shop owner is signed in with a Supabase session instead, holds no token,
-- and was told to sign in as staff to use a feature on their own shop. That
-- read as "discounts are staff only", which is what it was.
--
-- WHY A GRANT WAS MISSING RATHER THAN A FUNCTION
--
-- migrations/010_member2_all_tables.sql already wrote the row policies for this:
--
--   "Shop owners can manage their own products"    on customer_products
--   "Shop owners can manage their own inventory"    on shop_inventory
--
-- both `for all to authenticated`, scoped by owns_customer_shop(shop_id), which
-- is customer_shops.profile_id = auth.uid(). So the access rules were written
-- correctly. What never reached the database is the privilege half -- the
-- grants at the end of 010, and these two policies themselves. Confirmed against
-- the deployed project: a write is rejected with 42501 permission denied for
-- table customer_products from every role.
--
--   011_grant_anon_public_access.sql grants SELECT on customer_products
--   006_shop_operations.sql:680 grants select, update on shop_inventory
--
-- RLS policies without a matching grant are inert: the request is rejected at
-- 42501 before the policy is ever consulted. 018 worked around that with
-- SECURITY DEFINER functions for the staff token; the owner path was left with
-- no workaround at all.
--
-- This file closes that gap with the grant, rather than with more functions.
-- One mechanism for each kind of caller:
--
--   staff  a PIN token, validated inside a SECURITY DEFINER function (018-021)
--   owner  a Supabase session, validated by these RLS policies
--
-- WHY THE UPDATE GRANT IS TABLE LEVEL
--
-- customer_products holds nothing but catalogue and stock fields. The policy's
-- USING and WITH CHECK clauses are what scope it, and they are evaluated per
-- row: a clerk's own product, someone else's, and a row moved to a different
-- shop are all decided by that clause rather than by the grant. Column-level
-- grants would add a second thing to keep in step with every future migration
-- for no extra protection.
--
-- Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Row level security
--
-- The grants below are only safe while RLS is doing the scoping, so it is
-- asserted rather than assumed. Enabling it is a no-op on a table that already
-- has it.
-- -----------------------------------------------------------------------------
alter table public.customer_products enable row level security;
alter table public.shop_inventory enable row level security;


-- -----------------------------------------------------------------------------
-- 2. The owner policies
--
-- Rebuilt verbatim from 010 so this file is self-contained: a project that never
-- received 010 still ends up with the same rules. 010's versions are dropped
-- first so re-running leaves exactly one policy rather than two that have to be
-- kept in agreement.
-- -----------------------------------------------------------------------------
drop policy if exists "Shop owners can manage their own products"
  on public.customer_products;

create policy "Shop owners can manage their own products"
  on public.customer_products for all to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()))
  with check ((select public.owns_customer_shop(shop_id))
              or (select public.is_admin()));

drop policy if exists "Shop owners can manage their own inventory"
  on public.shop_inventory;

create policy "Shop owners can manage their own inventory"
  on public.shop_inventory for all to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()))
  with check ((select public.owns_customer_shop(shop_id))
              or (select public.is_admin()));

-- is_admin() and owns_customer_shop() are called per row, so both are pinned to
-- a fixed search_path exactly as 010 left them.
grant execute on function public.owns_customer_shop(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. The grants that make the policies reachable
--
-- `authenticated` only, and deliberately not `anon`: the publishable key ships
-- inside the app, so anything granted to anon is public. Staff still go through
-- the 018-021 functions and need none of this.
--
-- 010 already listed these three tables in its own grant block, so where that
-- ran the owner path works today and this is a no-op. It is repeated because the
-- deployed project never received 010's grants -- anon still gets
-- 42501 permission denied for table customer_products -- and RLS policies
-- without a matching grant are inert.
--
-- shop_inventory already had select, update from 006, so only the rest is
-- added. delete is included for consistency with 010 rather than because
-- anything in the app needs it.
-- -----------------------------------------------------------------------------
grant insert, update, delete on
  public.customer_products,
  public.shop_inventory
  to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Tell PostgREST
--
-- Privilege changes are not part of the schema cache, so a stale cache keeps
-- answering 42501 for a grant that is in fact present.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';


-- =============================================================================
-- VERIFY - both rows should show granted = t, and every policy should be owned
-- by an owner-scoped expression.
-- =============================================================================

select table_name,
       has_table_privilege('authenticated', table_name, 'update') as can_update,
       has_table_privilege('authenticated', table_name, 'insert') as can_insert,
       has_table_privilege('anon',         table_name, 'update') as anon_update,
       has_table_privilege('anon',         table_name, 'insert') as anon_insert
from information_schema.tables
where table_schema = 'public'
  and table_name in ('customer_products', 'shop_inventory')
order by table_name;

-- Expect one row per table, permissive, for insert/update/delete/select.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('customer_products', 'shop_inventory')
order by tablename, policyname;
