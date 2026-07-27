-- =============================================================================
-- Cursor Hyderabad — Multi-event Credit Claim Portal
-- Run this in the Supabase SQL editor to set up a fresh database.
-- If you already deployed the single-event version, run
-- `multi-event-migration.sql` instead — it preserves existing data.
-- Safe to re-run end-to-end on an empty DB.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- events: one row per meetup / hackathon / Cafe Cursor
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
  -- Luma event api id (e.g. evt-...) for check-in webhook → auto credit
  luma_event_id   text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create unique index if not exists events_luma_event_id_uidx
  on public.events (luma_event_id)
  where luma_event_id is not null;

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
-- attendees: approved participants per event
-- ============================================================================
create table if not exists public.attendees (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references public.events(id) on delete cascade,
  email                   text not null,
  name                    text,
  claimed                 boolean not null default false,
  claimed_at              timestamptz,
  credit_email_sent_at    timestamptz,
  credit_link_clicked_at  timestamptz,
  credit_id   uuid,
  created_at  timestamptz not null default now()
);

-- Same email can exist in multiple events; uniqueness is per-event.
create unique index if not exists attendees_event_email_lower_idx
  on public.attendees (event_id, lower(email));
create index if not exists attendees_event_id_idx on public.attendees (event_id);

-- ============================================================================
-- credit_links: pool of one-time Cursor credit URLs, scoped per event
-- ============================================================================
create table if not exists public.credit_links (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  cursor_url    text not null unique,
  assigned_to   uuid references public.attendees(id) on delete set null,
  assigned_at   timestamptz,
  used          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists credit_links_event_id_idx on public.credit_links (event_id);
create index if not exists credit_links_unused_per_event_idx
  on public.credit_links (event_id, used) where used = false;

-- backfill FK on attendees → credit_links (added after both exist)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'attendees_credit_id_fkey'
  ) then
    alter table public.attendees
      add constraint attendees_credit_id_fkey
      foreign key (credit_id) references public.credit_links(id) on delete set null;
  end if;
end $$;

-- ============================================================================
-- claim_attempts: audit log for rate limiting + analytics
-- ============================================================================
create table if not exists public.claim_attempts (
  id              bigserial primary key,
  event_id        uuid references public.events(id) on delete set null,
  email           text,
  ip              text,
  outcome         text not null,
  user_agent      text,
  source          text,              -- public | luma | admin
  email_delivered boolean,
  created_at      timestamptz not null default now()
);

create index if not exists claim_attempts_created_at_idx on public.claim_attempts (created_at desc);
create index if not exists claim_attempts_ip_idx         on public.claim_attempts (ip, created_at desc);
create index if not exists claim_attempts_event_id_idx   on public.claim_attempts (event_id);
create index if not exists claim_attempts_source_idx     on public.claim_attempts (source, created_at desc);

-- ============================================================================
-- claim_attendee_credit(p_email, p_event_slug): atomic, event-scoped claim
-- ============================================================================
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
  select * into v_event
  from public.events
  where slug = lower(trim(p_event_slug))
    and active = true;

  if not found then
    return query select 'event_not_found'::text, null::text, null::uuid, null::text, null::text;
    return;
  end if;

  select * into v_attendee
  from public.attendees
  where event_id = v_event.id
    and lower(email) = lower(trim(p_email))
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::text, v_event.name;
    return;
  end if;

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

-- ============================================================================
-- revoke_credit(p_attendee_id): admin frees a credit (already event-scoped via attendee)
-- ============================================================================
create or replace function public.revoke_credit(p_attendee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
begin
  select credit_id into v_credit_id
  from public.attendees
  where id = p_attendee_id
  for update;

  if v_credit_id is null then
    update public.attendees
       set claimed = false, claimed_at = null
     where id = p_attendee_id;
    return true;
  end if;

  update public.credit_links
     set used = false, assigned_to = null, assigned_at = null
   where id = v_credit_id;

  update public.attendees
     set claimed = false, claimed_at = null, credit_id = null
   where id = p_attendee_id;

  return true;
end;
$$;

-- ============================================================================
-- reissue_credit(p_attendee_id): burn old URL (keep used) + assign a fresh one
-- ============================================================================
create or replace function public.reissue_credit(p_attendee_id uuid)
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
  v_attendee record;
  v_event    record;
  v_old_credit_id uuid;
  v_credit   record;
begin
  select * into v_attendee
  from public.attendees
  where id = p_attendee_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::text, null::text;
    return;
  end if;

  select * into v_event
  from public.events
  where id = v_attendee.event_id;

  if not found then
    return query select 'event_not_found'::text, null::text, v_attendee.id, v_attendee.name, null::text;
    return;
  end if;

  v_old_credit_id := v_attendee.credit_id;

  if v_old_credit_id is not null then
    update public.credit_links
       set assigned_to = null,
           assigned_at = null,
           used = true
     where id = v_old_credit_id;
  end if;

  update public.attendees
     set claimed = false,
         claimed_at = null,
         credit_id = null,
         credit_email_sent_at = null,
         credit_link_clicked_at = null
   where id = v_attendee.id;

  select * into v_credit
  from public.credit_links
  where event_id = v_attendee.event_id
    and used = false
    and id is distinct from v_old_credit_id
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

revoke all on function public.reissue_credit(uuid) from public;
revoke all on function public.reissue_credit(uuid) from anon, authenticated;
grant execute on function public.reissue_credit(uuid) to service_role;

-- ============================================================================
-- transfer_unused_credits(source, target): move leftover (unused) pool URLs
-- ============================================================================
create or replace function public.transfer_unused_credits(
  p_source_event_id uuid,
  p_target_event_id uuid
)
returns table (
  status      text,
  transferred integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if p_source_event_id = p_target_event_id then
    return query select 'same_event'::text, 0;
    return;
  end if;

  if not exists (select 1 from public.events where id = p_source_event_id) then
    return query select 'source_not_found'::text, 0;
    return;
  end if;

  if not exists (select 1 from public.events where id = p_target_event_id) then
    return query select 'target_not_found'::text, 0;
    return;
  end if;

  update public.credit_links
     set event_id = p_target_event_id
   where event_id = p_source_event_id
     and used = false;

  get diagnostics v_count = row_count;

  return query select 'success'::text, v_count;
end;
$$;

revoke all on function public.transfer_unused_credits(uuid, uuid) from public;
revoke all on function public.transfer_unused_credits(uuid, uuid) from anon, authenticated;
grant execute on function public.transfer_unused_credits(uuid, uuid) to service_role;

-- ============================================================================
-- RLS
-- ============================================================================
-- Idempotency for inbound Luma webhooks (Webhook-Id header)
create table if not exists public.webhook_deliveries (
  id           text primary key,
  event_type   text,
  outcome      text,
  email        text,
  event_id     uuid references public.events(id) on delete set null,
  processed_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_processed_at_idx
  on public.webhook_deliveries (processed_at desc);

alter table public.events             enable row level security;
alter table public.attendees          enable row level security;
alter table public.credit_links       enable row level security;
alter table public.claim_attempts     enable row level security;
alter table public.webhook_deliveries enable row level security;

drop policy if exists "deny all" on public.events;
drop policy if exists "deny all" on public.attendees;
drop policy if exists "deny all" on public.credit_links;
drop policy if exists "deny all" on public.claim_attempts;
drop policy if exists "deny all" on public.webhook_deliveries;

-- ============================================================================
-- Views for the admin dashboard
-- ============================================================================
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
