-- =============================================================================
-- LUMA CHECK-IN → AUTO CREDIT MIGRATION
-- Adds events.luma_event_id mapping + webhook_deliveries idempotency table.
-- Run once in the Supabase SQL editor on an existing database.
-- Safe / idempotent.
-- =============================================================================

alter table public.events
  add column if not exists luma_event_id text;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'events_luma_event_id_uidx'
  ) then
    create unique index events_luma_event_id_uidx
      on public.events (luma_event_id)
      where luma_event_id is not null;
  end if;
end $$;

-- Idempotency for Luma webhook deliveries (Webhook-Id header)
create table if not exists public.webhook_deliveries (
  id           text primary key,
  event_type   text,
  outcome      text,
  processed_at timestamptz not null default now()
);

alter table public.webhook_deliveries enable row level security;
drop policy if exists "deny all" on public.webhook_deliveries;

-- Refresh event_stats to expose luma_event_id for admin UI
drop view if exists public.event_stats;
create view public.event_stats with (security_invoker = true) as
select
  e.id   as event_id,
  e.slug,
  e.name,
  e.active,
  e.event_date,
  e.luma_event_id,
  (select count(*) from public.attendees a where a.event_id = e.id)                              as total_attendees,
  (select count(*) from public.attendees a where a.event_id = e.id and a.claimed)                as total_claimed,
  (select count(*) from public.credit_links c where c.event_id = e.id)                           as total_credits,
  (select count(*) from public.credit_links c where c.event_id = e.id and not c.used)            as remaining_credits
from public.events e;

revoke all on public.event_stats from anon, authenticated;
