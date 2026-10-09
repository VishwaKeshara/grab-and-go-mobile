BEGIN;

-- Proper manual profile_id duplicate checks before the index
DO $$
BEGIN
  IF EXISTS (
    SELECT profile_id
    FROM public.customer_shops
    WHERE profile_id IS NOT NULL
    GROUP BY profile_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate shop owners exist; cannot enforce one shop per owner';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS customer_shops_profile_id_uidx
ON public.customer_shops(profile_id)
WHERE profile_id IS NOT NULL;

create or replace function public.register_shop(
  p_shop_name text,
  p_address text,
  p_phone text,
  p_pickup_counter text,
  p_prep_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_shop_id uuid;
  v_role text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure profile exists and is not admin
  select role into v_role from public.profiles where id = v_user_id;
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_role = 'admin' then
    raise exception 'Admins cannot register shops';
  end if;

  -- Prevent duplicate shop
  if exists (select 1 from public.customer_shops where profile_id = v_user_id) then
    raise exception 'Profile already owns a shop';
  end if;

  -- Validate inputs
  if p_shop_name is null or length(trim(p_shop_name)) < 2 then
    raise exception 'Shop name is required and must be at least 2 characters';
  end if;
  if p_address is null or length(trim(p_address)) < 5 then
    raise exception 'Address is required and must be at least 5 characters';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9\s\-()]{7,15}$' then
    raise exception 'Valid phone number is required';
  end if;
  if p_pickup_counter is null or length(trim(p_pickup_counter)) < 2 or length(trim(p_pickup_counter)) > 120 then
    raise exception 'Pickup counter is required and must be between 2 and 120 characters';
  end if;
  if p_prep_minutes is null or p_prep_minutes < 1 or p_prep_minutes > 180 then
    raise exception 'Preparation minutes must be between 1 and 180';
  end if;

  -- Insert shop
  insert into public.customer_shops (
    name,
    address,
    phone,
    pickup_counter,
    preparation_minutes,
    profile_id,
    active,
    is_open
  ) values (
    trim(p_shop_name),
    trim(p_address),
    trim(p_phone),
    trim(p_pickup_counter),
    p_prep_minutes,
    v_user_id,
    true,
    true
  ) returning id into v_shop_id;

  -- Update role to shop
  update public.profiles
  set role = 'shop'
  where id = v_user_id;

  return v_shop_id;
end;
$$;

revoke all on function public.register_shop(text, text, text, text, integer) from public;
grant execute on function public.register_shop(text, text, text, text, integer) to authenticated;

COMMIT;
