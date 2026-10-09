-- Authenticated staff need a profile role so admins can target their notification inbox.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'shop', 'staff', 'admin));
