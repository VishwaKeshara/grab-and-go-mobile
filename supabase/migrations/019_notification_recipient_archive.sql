alter table public.notifications
  add column if not exists recipient_deleted_at timestamptz;
