create extension if not exists "pgcrypto";

create table if not exists public.pickup_hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer', 'shop', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  onboarding_seen boolean not null default false,
  preferred_pickup_hub_id uuid references public.pickup_hubs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_preferred_pickup_hub_idx
  on public.profiles(preferred_pickup_hub_id);

insert into public.pickup_hubs (name, address)
values
  ('Malabe Bazaar Hub', 'Kaduwela Road (Opposite SLIIT Junction)'),
  ('Pittugala Station Hub', 'Near Chandrika Kumaratunga Mawatha')
on conflict do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, preferred_pickup_hub_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    nullif(new.raw_user_meta_data ->> 'preferred_pickup_hub_id', '')::uuid
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    preferred_pickup_hub_id = excluded.preferred_pickup_hub_id,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.pickup_hubs enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read active pickup hubs" on public.pickup_hubs;
create policy "Authenticated users can read active pickup hubs"
  on public.pickup_hubs for select
  to authenticated
  using (is_active = true);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.pickup_hubs to authenticated;
grant select, update on public.profiles to authenticated;