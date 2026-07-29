-- =============================================================================
-- CHECK-IN TRACKING MIGRATION
-- Adds attendees.checked_in_at so we can tell "checked in at the door but got
-- no credit (pool empty)" apart from "imported but never showed up".
-- The Luma webhook stamps this on first check-in; it is never overwritten.
-- Safe / idempotent. Run once in the Supabase SQL editor.
-- =============================================================================

alter table public.attendees
  add column if not exists checked_in_at timestamptz;

create index if not exists attendees_checked_in_idx
  on public.attendees (event_id, checked_in_at)
  where checked_in_at is not null;
