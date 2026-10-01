revoke update on public.profiles from authenticated;

grant update (full_name, phone, onboarding_seen, preferred_pickup_hub_id)
  on public.profiles to authenticated;