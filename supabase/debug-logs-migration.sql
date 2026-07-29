-- =============================================================================
-- DEBUG LOGS MIGRATION
-- Adds system_logs so webhook / email errors are visible in the admin UI
-- (floating debug panel) instead of only in Vercel function logs.
-- Safe / idempotent. Run once in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.system_logs (
  id         bigserial primary key,
  level      text not null default 'info',   -- info | warn | error
  source     text not null,                  -- luma-webhook | claim | email | gift | admin
  message    text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists system_logs_created_at_idx
  on public.system_logs (created_at desc);

alter table public.system_logs enable row level security;
drop policy if exists "deny all" on public.system_logs;
