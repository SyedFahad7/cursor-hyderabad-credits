-- =============================================================================
-- LEFTOVER CREDITS MIGRATION
-- Adds transfer_unused_credits() so admins can move unused credit URLs from
-- one event's pool to another.
--
-- Run this once in the Supabase SQL editor on an existing database.
-- Safe / idempotent (CREATE OR REPLACE).
-- =============================================================================

-- ============================================================================
-- transfer_unused_credits(source, target)
-- Moves credit_links where used = false from source event → target event.
-- Used / assigned credits are never moved.
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
