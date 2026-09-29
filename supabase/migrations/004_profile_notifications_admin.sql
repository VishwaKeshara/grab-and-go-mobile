alter table public.profiles add column if not exists email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where profiles.id = users.id
  and profiles.email is distinct from users.email;

create index if not exists profiles_email_idx on public.profiles(email);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'general' check (kind in ('general', 'order', 'price', 'pickup', 'offer', 'security')),
  title text not null,
  body text not null,
  action_label text,
  action_route text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, preferred_pickup_hub_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    nullif(new.raw_user_meta_data ->> 'preferred_pickup_hub_id', '')::uuid
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    preferred_pickup_hub_id = excluded.preferred_pickup_hub_id,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

alter table public.notifications enable row level security;

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
  on public.notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their notifications" on public.notifications;
create policy "Users can delete their notifications"
  on public.notifications for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update user status" on public.profiles;
create policy "Admins can update user status"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.is_admin() to authenticated;
grant select, update, delete on public.notifications to authenticated;