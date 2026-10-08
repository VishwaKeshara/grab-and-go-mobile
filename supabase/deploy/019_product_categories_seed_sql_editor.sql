-- ============================================================================
--  RUN THIS WHOLE FILE IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Seeds the six grocery categories and applies the two renames:
--    "Pantry Staples" -> "Pantry & Dry Goods"
--    "Household"      -> "Biscuits & Snacks"
--
--  WHY IT IS NEEDED - verified against project buazpscpiufcndssxgyi on
--  2026-10-08:
--
--    product_categories   the table exists but holds 0 rows
--    customer_products    13 rows, category_id null on all of them
--
--  customer_products.category_id and the Add Product form's category picker
--  both already exist. The picker had nothing to show, so it rendered "No
--  categories available yet." and no product could be given a category.
--
--  This is a category seed only. It does not touch shop_inventory: category is
--  a property of the product, not of a shop's stock of it, and it already
--  lives on customer_products.
--
--  Safe to run more than once. Every statement is idempotent and never resets
--  is_active, which a shop may have switched off.
-- ============================================================================

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

-- 2. All six, inserted only when missing. The equivalent statements in 009/010
--    used `do update`, which reset is_active on every run, so an admin
--    switching a category off had it turned back on by the next seed.
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


-- =============================================================================
-- VERIFY - expect 6 rows: Pantry & Dry Goods and Biscuits & Snacks present,
-- neither old slug left behind.
-- =============================================================================
select name, slug, is_active, sort_order
from public.product_categories
order by sort_order, name;