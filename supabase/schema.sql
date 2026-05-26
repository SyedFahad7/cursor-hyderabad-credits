-- =============================================================================
-- Cursor Hyderabad Meetup — Credit Claim Portal
-- Run this in the Supabase SQL editor to set up the schema.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- attendees: approved participants who registered via Luma.
-- ============================================================================
create table if not exists public.attendees (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  name         text,
  claimed      boolean not null default false,
  claimed_at   timestamptz,
  credit_id    uuid,
  created_at   timestamptz not null default now()
);

-- store + match emails case-insensitively
create unique index if not exists attendees_email_lower_idx
  on public.attendees (lower(email));

-- ============================================================================
-- credit_links: the pool of one-time Cursor credit URLs.
-- ============================================================================
create table if not exists public.credit_links (
  id            uuid primary key default gen_random_uuid(),
  cursor_url    text not null unique,
  assigned_to   uuid references public.attendees(id) on delete set null,
  assigned_at   timestamptz,
  used          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists credit_links_unused_idx
  on public.credit_links (used) where used = false;

-- backfill the FK on attendees pointing into credit_links (added after both exist)
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
-- claim_attempts: lightweight audit log for rate limiting + analytics.
-- ============================================================================
create table if not exists public.claim_attempts (
  id          bigserial primary key,
  email       text,
  ip          text,
  outcome     text not null, -- 'success' | 'duplicate' | 'not_found' | 'no_credits' | 'rate_limited' | 'error'
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists claim_attempts_created_at_idx
  on public.claim_attempts (created_at desc);
create index if not exists claim_attempts_ip_idx
  on public.claim_attempts (ip, created_at desc);

-- ============================================================================
-- claim_attendee_credit(p_email): atomic claim function.
-- Returns the assigned cursor_url (and attendee name) or NULL columns with
-- an error code so the API can return precise responses.
-- ============================================================================
create or replace function public.claim_attendee_credit(p_email text)
returns table (
  status      text,
  cursor_url  text,
  attendee_id uuid,
  attendee_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendee record;
  v_credit   record;
begin
  -- 1) Look up & lock the attendee row
  select * into v_attendee
  from public.attendees
  where lower(email) = lower(trim(p_email))
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::text;
    return;
  end if;

  -- 2) Already claimed? Return their existing assignment.
  if v_attendee.claimed = true then
    select cl.cursor_url into v_credit
    from public.credit_links cl
    where cl.id = v_attendee.credit_id;

    return query select 'already_claimed'::text,
                        coalesce(v_credit.cursor_url, ''::text),
                        v_attendee.id,
                        v_attendee.name;
    return;
  end if;

  -- 3) Pick the next available credit (FOR UPDATE SKIP LOCKED prevents races)
  select * into v_credit
  from public.credit_links
  where used = false
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return query select 'no_credits'::text, null::text, v_attendee.id, v_attendee.name;
    return;
  end if;

  -- 4) Assign + mark consumed atomically
  update public.credit_links
     set used = true,
         assigned_to = v_attendee.id,
         assigned_at = now()
   where id = v_credit.id;

  update public.attendees
     set claimed = true,
         claimed_at = now(),
         credit_id  = v_credit.id
   where id = v_attendee.id;

  return query select 'success'::text,
                      v_credit.cursor_url,
                      v_attendee.id,
                      v_attendee.name;
end;
$$;

-- ============================================================================
-- revoke_credit(p_attendee_id): admin can free up a credit and reset attendee.
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
-- Row-Level Security: lock everything down. The service-role key (server-only)
-- bypasses RLS, the anon key cannot read or write directly.
-- ============================================================================
alter table public.attendees      enable row level security;
alter table public.credit_links   enable row level security;
alter table public.claim_attempts enable row level security;

-- Drop any pre-existing permissive policies (idempotent re-run)
drop policy if exists "deny all" on public.attendees;
drop policy if exists "deny all" on public.credit_links;
drop policy if exists "deny all" on public.claim_attempts;

-- No policies = no access for anon. Service role bypasses RLS entirely.

-- ============================================================================
-- Helpful views for the admin dashboard
-- WITH (security_invoker = true) makes the view respect the caller's RLS
-- (silences Supabase's "Security Definer View" advisor warning).
-- The server-side service-role client bypasses RLS, so the app keeps working;
-- anon/authenticated callers cannot read this view by design.
-- ============================================================================
drop view if exists public.dashboard_stats;
create view public.dashboard_stats
with (security_invoker = true) as
select
  (select count(*) from public.attendees)                                as total_attendees,
  (select count(*) from public.attendees where claimed = true)           as total_claimed,
  (select count(*) from public.credit_links)                             as total_credits,
  (select count(*) from public.credit_links where used = false)          as remaining_credits;

revoke all on public.dashboard_stats from anon, authenticated;
