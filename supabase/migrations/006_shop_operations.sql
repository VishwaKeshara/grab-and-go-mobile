-- ============================================================
-- Migration 006 — Member 4: Shop Operations & Administration
-- Prerequisite: migration 005 must already be applied.
-- Requires existing:
--   public.customer_shops
--   public.customer_products
--   public.customer_orders
--   public.customer_order_items
--   public.profiles
--   public.pickup_hubs
--   public.is_admin()
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Crypto support
-- ------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1. Extend customer_shops
-- ------------------------------------------------------------
alter table public.customer_shops
  add column if not exists profile_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists hub_id uuid
    references public.pickup_hubs(id) on delete set null,
  add column if not exists is_open boolean not null default false,
  add column if not exists opened_at timestamptz;

create index if not exists customer_shops_profile_idx
  on public.customer_shops(profile_id);

-- ------------------------------------------------------------
-- 2. Extend customer_orders
-- ------------------------------------------------------------
alter table public.customer_orders
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists accepted_at timestamptz,
  add column if not exists packing_started_at timestamptz,
  add column if not exists ready_at timestamptz;

create or replace function public.set_customer_orders_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_orders_set_updated_at
  on public.customer_orders;

create trigger customer_orders_set_updated_at
before update on public.customer_orders
for each row
execute function public.set_customer_orders_updated_at();

-- Enforce valid order lifecycle transitions.
create or replace function public.check_order_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'placed'
     and new.status in ('accepted', 'cancelled') then
    return new;

  elsif old.status = 'accepted'
     and new.status in ('packing', 'cancelled') then
    return new;

  elsif old.status = 'packing'
     and new.status = 'ready' then
    return new;

  elsif old.status = 'ready'
     and new.status = 'collected' then
    return new;

  else
    raise exception
      'Invalid order status transition from % to %',
      old.status,
      new.status;
  end if;
end;
$$;

drop trigger if exists customer_orders_check_status_transition
  on public.customer_orders;

create trigger customer_orders_check_status_transition
before update of status on public.customer_orders
for each row
execute function public.check_order_status_transition();

-- ------------------------------------------------------------
-- 3. Extend customer_order_items
-- ------------------------------------------------------------
alter table public.customer_order_items
  add column if not exists is_packed boolean not null default false,
  add column if not exists packed_at timestamptz;

-- ------------------------------------------------------------
-- 4. shop_staff
-- ------------------------------------------------------------
create table if not exists public.shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.customer_shops(id) on delete cascade,
  staff_code text not null,
  full_name text not null,
  phone text,
  role text not null default 'clerk'
    check (role in ('clerk', 'manager')),
  shift text not null default 'morning'
    check (shift in ('morning', 'evening')),
  pin_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, staff_code)
);

create index if not exists shop_staff_shop_idx
  on public.shop_staff(shop_id);

-- Safe client-facing view. pin_hash is intentionally omitted.
create or replace view public.shop_staff_safe
with (security_invoker = true)
as
select
  id,
  shop_id,
  staff_code,
  full_name,
  phone,
  role,
  shift,
  is_active,
  created_at
from public.shop_staff;

-- ------------------------------------------------------------
-- 5. shop_inventory
-- ------------------------------------------------------------
create table if not exists public.shop_inventory (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.customer_shops(id) on delete cascade,
  product_id uuid not null
    references public.customer_products(id) on delete cascade,
  quantity integer not null default 0
    check (quantity >= 0),
  low_stock_threshold integer not null default 5
    check (low_stock_threshold >= 0),
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists shop_inventory_shop_idx
  on public.shop_inventory(shop_id);

create index if not exists shop_inventory_product_idx
  on public.shop_inventory(product_id);

-- ------------------------------------------------------------
-- 6. pickup_verifications
-- Multiple attempts/events are allowed for one order.
-- ------------------------------------------------------------
create table if not exists public.pickup_verifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.customer_orders(id) on delete cascade,
  verified_by uuid
    references public.shop_staff(id) on delete set null,
  verification_method text not null default 'pin'
    check (verification_method in ('pin', 'qr', 'manual')),
  handover_status text not null default 'completed'
    check (handover_status in ('completed', 'rejected', 'partial')),
  notes text,
  verified_at timestamptz not null default now()
);

create index if not exists pickup_verifications_order_idx
  on public.pickup_verifications(order_id);

-- ------------------------------------------------------------
-- 7. security_events
-- ------------------------------------------------------------
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (
      event_type in (
        'failed_login',
        'pin_lockout',
        'admin_login',
        'terminal_auth',
        'geofence',
        'order_anomaly',
        'key_rotation',
        'status_change'
      )
    ),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  title text not null,
  description text,
  user_id uuid
    references auth.users(id) on delete set null,
  shop_id uuid
    references public.customer_shops(id) on delete set null,
  staff_id uuid
    references public.shop_staff(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists security_events_created_idx
  on public.security_events(created_at desc);

create index if not exists security_events_severity_status_idx
  on public.security_events(severity, status);

-- ------------------------------------------------------------
-- 8. Enable RLS on new tables
-- ------------------------------------------------------------
alter table public.shop_staff enable row level security;
alter table public.shop_inventory enable row level security;
alter table public.pickup_verifications enable row level security;
alter table public.security_events enable row level security;

-- ------------------------------------------------------------
-- 9. Helper: is_shop_owner(shop_id)
-- Database authorization uses the Supabase Auth user linked through
-- customer_shops.profile_id.
-- ------------------------------------------------------------
create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_shops
    where id = p_shop_id
      and profile_id = auth.uid()
      and active = true
  );
$$;

revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_shop_owner(uuid) to authenticated;

-- ------------------------------------------------------------
-- 10. RLS — customer_orders
-- Existing customer policies are left untouched.
-- ------------------------------------------------------------
drop policy if exists "Shop owner can view their shop orders"
  on public.customer_orders;

create policy "Shop owner can view their shop orders"
on public.customer_orders
for select
to authenticated
using (
  public.is_shop_owner(shop_id)
  or public.is_admin()
);

drop policy if exists "Shop owner can update order status"
  on public.customer_orders;

create policy "Shop owner can update order status"
on public.customer_orders
for update
to authenticated
using (
  public.is_shop_owner(shop_id)
  or public.is_admin()
)
with check (
  public.is_shop_owner(shop_id)
  or public.is_admin()
);

-- ------------------------------------------------------------
-- 11. RLS — customer_order_items
-- ------------------------------------------------------------
drop policy if exists "Shop owner can view their order items"
  on public.customer_order_items;

create policy "Shop owner can view their order items"
on public.customer_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_orders o
    where o.id = order_id
      and (
        public.is_shop_owner(o.shop_id)
        or public.is_admin()
      )
  )
);

drop policy if exists "Shop owner can update packing state"
  on public.customer_order_items;

create policy "Shop owner can update packing state"
on public.customer_order_items
for update
to authenticated
using (
  exists (
    select 1
    from public.customer_orders o
    where o.id = order_id
      and (
        public.is_shop_owner(o.shop_id)
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.customer_orders o
    where o.id = order_id
      and (
        public.is_shop_owner(o.shop_id)
        or public.is_admin()
      )
  )
);

-- ------------------------------------------------------------
-- 12. RLS — shop_staff
-- ------------------------------------------------------------
drop policy if exists "Shop owner can read their staff"
  on public.shop_staff;

create policy "Shop owner can read their staff"
on public.shop_staff
for select
to authenticated
using (
  public.is_shop_owner(shop_id)
  or public.is_admin()
);

drop policy if exists "Admins can manage shop staff"
  on public.shop_staff;

create policy "Admins can manage shop staff"
on public.shop_staff
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- 13. RLS — shop_inventory
-- ------------------------------------------------------------
drop policy if exists "Shop owner can read their inventory"
  on public.shop_inventory;

create policy "Shop owner can read their inventory"
on public.shop_inventory
for select
to authenticated
using (
  public.is_shop_owner(shop_id)
  or public.is_admin()
);

drop policy if exists "Shop owner can update their inventory"
  on public.shop_inventory;

create policy "Shop owner can update their inventory"
on public.shop_inventory
for update
to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

drop policy if exists "Admins can manage inventory"
  on public.shop_inventory;

create policy "Admins can manage inventory"
on public.shop_inventory
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- 14. RLS — pickup_verifications
-- ------------------------------------------------------------
drop policy if exists "Shop owner can insert verifications"
  on public.pickup_verifications;

create policy "Shop owner can insert verifications"
on public.pickup_verifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customer_orders o
    where o.id = order_id
      and public.is_shop_owner(o.shop_id)
  )
  or public.is_admin()
);

drop policy if exists "Shop owner can read verifications"
  on public.pickup_verifications;

create policy "Shop owner can read verifications"
on public.pickup_verifications
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_orders o
    where o.id = order_id
      and (
        public.is_shop_owner(o.shop_id)
        or public.is_admin()
      )
  )
);

-- ------------------------------------------------------------
-- 15. RLS — security_events
-- ------------------------------------------------------------
drop policy if exists "Admins can read security events"
  on public.security_events;

create policy "Admins can read security events"
on public.security_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "Authenticated users can insert security events"
  on public.security_events;

create policy "Authenticated users can insert security events"
on public.security_events
for insert
to authenticated
with check (
  public.is_shop_owner(shop_id)
  or public.is_admin()
);

drop policy if exists "Admins can update security event status"
  on public.security_events;

create policy "Admins can update security event status"
on public.security_events
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- 16. verify_staff_pin() RPC
-- Supabase Auth identifies/authorizes the shop account.
-- This RPC only verifies which staff member is operating the terminal.
-- ------------------------------------------------------------
create or replace function public.verify_staff_pin(
  p_staff_code text,
  p_pin_plain text,
  p_shop_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.shop_staff;
begin
  -- Only the authenticated owner of this shop (or admin) may verify staff.
  if not (
    public.is_shop_owner(p_shop_id)
    or public.is_admin()
  ) then
    raise exception 'Access denied';
  end if;

  select *
  into v_staff
  from public.shop_staff
  where shop_id = p_shop_id
    and staff_code = p_staff_code
    and is_active = true;

  if not found then
    insert into public.security_events (
      event_type,
      severity,
      title,
      shop_id
    )
    values (
      'failed_login',
      'warning',
      'Failed staff login: unknown staff code',
      p_shop_id
    );

    return jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  end if;

  if extensions.crypt(p_pin_plain, v_staff.pin_hash) = v_staff.pin_hash then
    return jsonb_build_object(
      'success', true,
      'staff_id', v_staff.id,
      'staff_code', v_staff.staff_code,
      'full_name', v_staff.full_name,
      'role', v_staff.role,
      'shift', v_staff.shift
    );
  else
    insert into public.security_events (
      event_type,
      severity,
      title,
      shop_id,
      staff_id
    )
    values (
      'failed_login',
      'warning',
      'Failed staff PIN attempt: ' || p_staff_code,
      p_shop_id,
      v_staff.id
    );

    return jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  end if;
end;
$$;

revoke all on function public.verify_staff_pin(text, text, uuid) from public;
grant execute on function public.verify_staff_pin(text, text, uuid)
  to authenticated;

-- ------------------------------------------------------------
-- 17. get_shop_dashboard_summary() RPC
-- ------------------------------------------------------------
create or replace function public.get_shop_dashboard_summary(
  p_shop_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_live_count bigint;
  v_packing_count bigint;
  v_ready_count bigint;
  v_completed_today bigint;
  v_revenue_today bigint;
  v_low_stock bigint;
begin
  if not (
    public.is_shop_owner(p_shop_id)
    or public.is_admin()
  ) then
    raise exception 'Access denied';
  end if;

  select count(*)
  into v_live_count
  from public.customer_orders
  where shop_id = p_shop_id
    and status in ('placed', 'accepted');

  select count(*)
  into v_packing_count
  from public.customer_orders
  where shop_id = p_shop_id
    and status = 'packing';

  select count(*)
  into v_ready_count
  from public.customer_orders
  where shop_id = p_shop_id
    and status = 'ready';

  select count(*)
  into v_completed_today
  from public.customer_orders
  where shop_id = p_shop_id
    and status = 'collected'
    and created_at >= current_date;

  select coalesce(sum(total_lkr), 0)
  into v_revenue_today
  from public.customer_orders
  where shop_id = p_shop_id
    and status <> 'cancelled'
    and created_at >= current_date;

  select count(*)
  into v_low_stock
  from public.shop_inventory
  where shop_id = p_shop_id
    and quantity <= low_stock_threshold
    and is_available = true;

  return jsonb_build_object(
    'liveOrderCount', v_live_count,
    'pendingPackingCount', v_packing_count,
    'readyForPickupCount', v_ready_count,
    'completedToday', v_completed_today,
    'grossSalesToday', v_revenue_today,
    'lowStockItemCount', v_low_stock
  );
end;
$$;

revoke all on function public.get_shop_dashboard_summary(uuid) from public;
grant execute on function public.get_shop_dashboard_summary(uuid)
  to authenticated;

-- ------------------------------------------------------------
-- 18. Column/table privileges
-- ------------------------------------------------------------

-- Restrict shop_staff so pin_hash is never selectable by normal clients.
revoke select on public.shop_staff from authenticated, anon;

grant select (
  id,
  shop_id,
  staff_code,
  full_name,
  phone,
  role,
  shift,
  is_active,
  created_at
) on public.shop_staff to authenticated;

grant select on public.shop_staff_safe to authenticated;

-- Shop-side operational privileges.
grant select, update on public.shop_inventory to authenticated;
grant select, insert on public.pickup_verifications to authenticated;
grant select, insert, update on public.security_events to authenticated;

-- Only these customer order columns may be updated by authenticated clients.
grant update (
  status,
  updated_at,
  accepted_at,
  packing_started_at,
  ready_at
) on public.customer_orders to authenticated;

grant update (
  is_packed,
  packed_at
) on public.customer_order_items to authenticated;

commit;
