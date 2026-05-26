-- =============================================================================
-- MULTI-EVENT MIGRATION
-- Adds support for multiple events (meetups, hackathons, Cafe Cursor, ...).
-- Safe to run on a live DB — preserves all existing rows by backfilling them
-- into a default 'hyderabad-meetup-may-24' event.
--
-- Run this once in the Supabase SQL editor AFTER the original schema.sql.
-- Idempotent (uses IF NOT EXISTS / ON CONFLICT throughout).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. events: one row per meetup / hackathon / Cafe Cursor
-- ============================================================================
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  tagline         text,
  credit_amount   text,
  event_date      date,
  organizer       text,
  host            text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- slug must be lowercase-kebab (a-z, 0-9, hyphens; must start/end alphanumeric)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'events_slug_format'
  ) then
    alter table public.events
      add constraint events_slug_format
      check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' and length(slug) between 2 and 60);
  end if;
end $$;

create index if not exists events_active_idx on public.events (active) where active = true;

-- ============================================================================
-- 2. Seed a default event so existing attendees + credit_links have a home
-- ============================================================================
insert into public.events (slug, name, tagline, host, organizer, credit_amount, active)
values (
  'hyderabad-meetup-may-24',
  'Cursor Hyderabad Meetup',
  'Get your free credits from Cursor. Sign up in seconds.',
  'Syed Fahad',
  'Cursor Hyderabad, India',
  '$15 in Cursor credits',
  true
)
on conflict (slug) do nothing;

-- ============================================================================
-- 3. Add event_id columns + backfill + enforce NOT NULL + FK
-- ============================================================================
alter table public.attendees      add column if not exists event_id uuid;
alter table public.credit_links   add column if not exists event_id uuid;
alter table public.claim_attempts add column if not exists event_id uuid;

update public.attendees
   set event_id = (select id from public.events where slug = 'hyderabad-meetup-may-24')
 where event_id is null;

update public.credit_links
   set event_id = (select id from public.events where slug = 'hyderabad-meetup-may-24')
 where event_id is null;

alter table public.attendees    alter column event_id set not null;
alter table public.credit_links alter column event_id set not null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'attendees_event_id_fkey'
  ) then
    alter table public.attendees
      add constraint attendees_event_id_fkey
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'credit_links_event_id_fkey'
  ) then
    alter table public.credit_links
      add constraint credit_links_event_id_fkey
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'claim_attempts_event_id_fkey'
  ) then
    alter table public.claim_attempts
      add constraint claim_attempts_event_id_fkey
      foreign key (event_id) references public.events(id) on delete set null;
  end if;
end $$;

-- ============================================================================
-- 4. Replace global unique-on-email with per-event unique
--    (same person CAN exist in multiple events — that's the whole point)
-- ============================================================================
drop index if exists public.attendees_email_lower_idx;
create unique index if not exists attendees_event_email_lower_idx
  on public.attendees (event_id, lower(email));

create index if not exists attendees_event_id_idx on public.attendees (event_id);
create index if not exists credit_links_event_id_idx on public.credit_links (event_id);
create index if not exists credit_links_unused_per_event_idx
  on public.credit_links (event_id, used) where used = false;
create index if not exists claim_attempts_event_id_idx on public.claim_attempts (event_id);

-- ============================================================================
-- 5. Replace claim RPC: now event-scoped via p_event_slug
-- ============================================================================
drop function if exists public.claim_attendee_credit(text);
drop function if exists public.claim_attendee_credit(text, text);

create or replace function public.claim_attendee_credit(
  p_email      text,
  p_event_slug text
)
returns table (
  status        text,
  cursor_url    text,
  attendee_id   uuid,
  attendee_name text,
  event_name    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event    record;
  v_attendee record;
  v_credit   record;
begin
  -- Resolve event
  select * into v_event
  from public.events
  where slug = lower(trim(p_event_slug))
    and active = true;

  if not found then
    return query select 'event_not_found'::text, null::text, null::uuid, null::text, null::text;
    return;
  end if;

  -- Lock the attendee row (scoped to this event)
  select * into v_attendee
  from public.attendees
  where event_id = v_event.id
    and lower(email) = lower(trim(p_email))
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::text, v_event.name;
    return;
  end if;

  -- Already claimed → return original assignment
  if v_attendee.claimed = true then
    select cl.cursor_url into v_credit
    from public.credit_links cl
    where cl.id = v_attendee.credit_id;

    return query select 'already_claimed'::text,
                        coalesce(v_credit.cursor_url, ''::text),
                        v_attendee.id,
                        v_attendee.name,
                        v_event.name;
    return;
  end if;

  -- Pick next available credit from THIS event's pool
  select * into v_credit
  from public.credit_links
  where event_id = v_event.id
    and used = false
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return query select 'no_credits'::text, null::text, v_attendee.id, v_attendee.name, v_event.name;
    return;
  end if;

  update public.credit_links
     set used = true, assigned_to = v_attendee.id, assigned_at = now()
   where id = v_credit.id;

  update public.attendees
     set claimed = true, claimed_at = now(), credit_id = v_credit.id
   where id = v_attendee.id;

  return query select 'success'::text,
                      v_credit.cursor_url,
                      v_attendee.id,
                      v_attendee.name,
                      v_event.name;
end;
$$;

-- revoke_credit stays the same (operates by attendee_id which is event-scoped already)

-- ============================================================================
-- 6. Per-event stats view + keep a global rollup
-- ============================================================================
drop view if exists public.event_stats;
create view public.event_stats with (security_invoker = true) as
select
  e.id   as event_id,
  e.slug,
  e.name,
  e.active,
  e.event_date,
  (select count(*) from public.attendees a where a.event_id = e.id)                              as total_attendees,
  (select count(*) from public.attendees a where a.event_id = e.id and a.claimed)                as total_claimed,
  (select count(*) from public.credit_links c where c.event_id = e.id)                           as total_credits,
  (select count(*) from public.credit_links c where c.event_id = e.id and not c.used)            as remaining_credits
from public.events e;

drop view if exists public.dashboard_stats;
create view public.dashboard_stats with (security_invoker = true) as
select
  (select count(*) from public.attendees)                                  as total_attendees,
  (select count(*) from public.attendees where claimed = true)             as total_claimed,
  (select count(*) from public.credit_links)                               as total_credits,
  (select count(*) from public.credit_links where used = false)            as remaining_credits,
  (select count(*) from public.events where active = true)                 as active_events;

revoke all on public.dashboard_stats from anon, authenticated;
revoke all on public.event_stats     from anon, authenticated;

-- ============================================================================
-- 7. RLS on events: deny anon, service role bypasses
-- ============================================================================
alter table public.events enable row level security;
drop policy if exists "deny all" on public.events;
