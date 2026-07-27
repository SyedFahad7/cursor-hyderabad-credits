-- =============================================================================
-- ACTIVITY LOGGING MIGRATION
-- Adds email delivery + click tracking fields for the admin Activity tab.
-- Run once in the Supabase SQL editor. Safe / idempotent.
-- =============================================================================

alter table public.claim_attempts
  add column if not exists source text;

alter table public.claim_attempts
  add column if not exists email_delivered boolean;

alter table public.webhook_deliveries
  add column if not exists email text;

alter table public.webhook_deliveries
  add column if not exists event_id uuid references public.events(id) on delete set null;

alter table public.attendees
  add column if not exists credit_email_sent_at timestamptz;

alter table public.attendees
  add column if not exists credit_link_clicked_at timestamptz;

create index if not exists claim_attempts_source_idx
  on public.claim_attempts (source, created_at desc);

create index if not exists webhook_deliveries_processed_at_idx
  on public.webhook_deliveries (processed_at desc);

create index if not exists attendees_credit_link_clicked_at_idx
  on public.attendees (credit_link_clicked_at desc)
  where credit_link_clicked_at is not null;
