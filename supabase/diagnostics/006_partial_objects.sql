-- Read-only inventory for a failed 006_member3_order_payment.sql attempt.
-- Run once in the Supabase SQL Editor and share the full result table.
-- This script does not create, drop, alter, or mark migrations as applied.
-- customer_orders_payment_status_check already exists in 005; inspect its
-- detail for demo_unpaid to tell whether 006 changed its definition.

with
expected_versions(version) as (
  values ('001'), ('002'), ('003'), ('004'), ('005'), ('006')
),
baseline_tables(table_name) as (
  values ('customer_shops'), ('customer_products'),
         ('customer_orders'), ('customer_order_items')
),
new_tables(table_name) as (
  values ('customer_carts'), ('customer_cart_items'),
         ('customer_pickup_slots'), ('customer_payments'),
         ('customer_order_status_history'), ('customer_shop_staff')
),
new_columns(table_name, column_name) as (
  values
    ('customer_shops', 'hub_id'),
    ('customer_shops', 'timezone'),
    ('customer_shops', 'pickup_open'),
    ('customer_shops', 'pickup_close'),
    ('customer_shops', 'pickup_interval_minutes'),
    ('customer_shops', 'max_orders_per_slot'),
    ('customer_products', 'available'),
    ('customer_products', 'stock_quantity'),
    ('customer_products', 'substitute_for'),
    ('customer_orders', 'pickup_slot_id'),
    ('customer_orders', 'pickup_mode'),
    ('customer_order_items', 'regular_price_lkr')
),
changed_constraints(table_name, constraint_name) as (
  values
    ('customer_shops', 'customer_shops_pickup_settings_check'),
    ('customer_shops', 'customer_shops_hub_id_fkey'),
    ('customer_products', 'customer_products_stock_check'),
    ('customer_products', 'customer_products_substitute_for_fkey'),
    ('customer_orders', 'customer_orders_payment_status_check'),
    ('customer_orders', 'customer_orders_pickup_slot_id_fkey'),
    ('customer_orders', 'customer_orders_pickup_mode_check'),
    ('customer_order_items', 'customer_order_items_regular_price_check')
),
new_indexes(index_name) as (
  values
    ('customer_products_substitute_idx'),
    ('customer_cart_items_product_idx'),
    ('customer_pickup_slots_shop_date_idx'),
    ('customer_orders_shop_slot_idx'),
    ('customer_order_status_history_order_idx'),
    ('customer_shop_staff_user_idx')
),
new_functions(signature) as (
  values
    ('public.is_active_customer()'),
    ('public.is_customer_shop_staff(uuid)'),
    ('public.record_customer_order_status()'),
    ('public.ensure_customer_pickup_slots(uuid,integer)'),
    ('public.get_customer_pickup_slots(uuid,integer)'),
    ('public.change_customer_cart(text,uuid,integer,jsonb)'),
    ('public.place_customer_order(text,uuid,uuid,integer,text,text,text,text,text)'),
    ('public.cancel_customer_order(uuid)'),
    ('public.set_customer_order_status(uuid,text)')
),
new_policies(table_name, policy_name) as (
  values
    ('customer_carts', 'Customer owns cart'),
    ('customer_cart_items', 'Customer owns cart items'),
    ('customer_shop_staff', 'Staff sees own assignment'),
    ('customer_pickup_slots', 'Available pickup slots'),
    ('customer_payments', 'Customer or staff sees payment'),
    ('customer_order_status_history', 'Customer or staff sees status history'),
    ('customer_shops', 'Assigned staff sees shop'),
    ('customer_shops', 'Customer sees ordered shop'),
    ('customer_products', 'Catalog and purchased products'),
    ('customer_orders', 'Customer or assigned staff sees order'),
    ('customer_order_items', 'Customer or assigned staff sees order items')
),
baseline_policies(table_name, policy_name) as (
  values
    ('customer_shops', 'Customers can view active shops'),
    ('customer_products', 'Customers can view active products'),
    ('customer_orders', 'Customers can view their orders'),
    ('customer_order_items', 'Customers can view their order items')
),
grantees(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
),
diagnostic as (
  select 'history'::text as category, v.version as object_name,
    exists (select 1 from supabase_migrations.schema_migrations m
      where m.version::text = v.version) as is_present,
    null::text as detail
  from expected_versions v

  union all
  select 'history_column', c.column_name, true,
    format('type=%s nullable=%s default=%s',
      c.data_type, c.is_nullable, coalesce(c.column_default, '(none)'))
  from information_schema.columns c
  where c.table_schema = 'supabase_migrations'
    and c.table_name = 'schema_migrations'

  union all
  select '005_table', 'public.' || t.table_name,
    to_regclass(format('public.%I', t.table_name)) is not null, null::text
  from baseline_tables t

  union all
  select '006_table', 'public.' || t.table_name,
    to_regclass(format('public.%I', t.table_name)) is not null, null::text
  from new_tables t

  union all
  select '006_column', 'public.' || c.table_name || '.' || c.column_name,
    a.attname is not null,
    case when a.attname is not null then format_type(a.atttypid, a.atttypmod) end
  from new_columns c
  left join pg_attribute a
    on a.attrelid = to_regclass(format('public.%I', c.table_name))
   and a.attname = c.column_name and a.attnum > 0 and not a.attisdropped

  union all
  select '006_constraint', 'public.' || c.table_name || '.' || c.constraint_name,
    p.oid is not null,
    case when p.oid is not null then pg_get_constraintdef(p.oid) end
  from changed_constraints c
  left join pg_constraint p
    on p.conrelid = to_regclass(format('public.%I', c.table_name))
   and p.conname = c.constraint_name

  union all
  select '006_index', 'public.' || i.index_name,
    p.oid is not null,
    case when p.oid is not null then pg_get_indexdef(p.oid) end
  from new_indexes i
  left join pg_class p
    on p.oid = to_regclass(format('public.%I', i.index_name))
   and p.relkind in ('i', 'I')

  union all
  select '006_function', f.signature,
    p.oid is not null,
    case when p.oid is not null then format(
      'security_definer=%s anon_execute=%s authenticated_execute=%s',
      p.prosecdef,
      has_function_privilege('anon', p.oid, 'EXECUTE'),
      has_function_privilege('authenticated', p.oid, 'EXECUTE')) end
  from new_functions f
  left join pg_proc p on p.oid = to_regprocedure(f.signature)

  union all
  select '006_trigger', 'public.customer_orders.customer_order_status_audit',
    t.oid is not null,
    case when t.oid is not null then pg_get_triggerdef(t.oid) end
  from (select 1) one_row
  left join pg_trigger t
    on t.tgrelid = to_regclass('public.customer_orders')
   and t.tgname = 'customer_order_status_audit' and not t.tgisinternal

  union all
  select '006_policy', 'public.' || p.table_name || '.' || p.policy_name,
    a.policyname is not null, a.qual
  from new_policies p
  left join pg_policies a
    on a.schemaname = 'public' and a.tablename = p.table_name
   and a.policyname = p.policy_name

  union all
  select '005_policy', 'public.' || p.table_name || '.' || p.policy_name,
    a.policyname is not null, a.qual
  from baseline_policies p
  left join pg_policies a
    on a.schemaname = 'public' and a.tablename = p.table_name
   and a.policyname = p.policy_name

  union all
  select '006_rls', 'public.' || t.table_name,
    coalesce(p.relrowsecurity, false),
    case when p.oid is null then 'table absent'
         when p.relrowsecurity then 'enabled'
         else 'disabled' end
  from new_tables t
  left join pg_class p
    on p.oid = to_regclass(format('public.%I', t.table_name))

  union all
  select 'privilege', 'public.' || t.table_name || ':' || g.role_name,
    p.oid is not null,
    case when p.oid is null then 'table absent' else format(
      'SELECT=%s INSERT=%s UPDATE=%s DELETE=%s',
      has_table_privilege(g.role_name, p.oid, 'SELECT'),
      has_table_privilege(g.role_name, p.oid, 'INSERT'),
      has_table_privilege(g.role_name, p.oid, 'UPDATE'),
      has_table_privilege(g.role_name, p.oid, 'DELETE')) end
  from (
    select table_name from baseline_tables
    union all select table_name from new_tables
  ) t
  cross join grantees g
  left join pg_class p
    on p.oid = to_regclass(format('public.%I', t.table_name))
)
select category, object_name,
  case when is_present then 'present' else 'absent' end as state,
  detail
from diagnostic
order by category, object_name;
