alter table public.notifications
  add column if not exists campaign_id uuid;

create index if not exists notifications_campaign_idx
  on public.notifications(campaign_id);
