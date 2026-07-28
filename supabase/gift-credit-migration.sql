-- =============================================================================
-- GIFT CREDIT MIGRATION
-- Admin can gift an unused leftover credit URL to any email.
-- Source: explicit event OR auto = oldest event that still has unused credits.
-- Safe / idempotent. Run once (or again) in the Supabase SQL editor.
-- =============================================================================

alter table public.attendees
  add column if not exists credit_email_sent_at timestamptz;

alter table public.attendees
  add column if not exists credit_link_clicked_at timestamptz;

-- Drop prior signature if return columns changed
drop function if exists public.gift_unused_credit(text, text, uuid);

create or replace function public.gift_unused_credit(
  p_email text,
  p_name text default null,
  p_source_event_id uuid default null
)
returns table (
  status             text,
  gift_cursor_url    text,
  gift_event_id      uuid,
  gift_event_name    text,
  gift_event_slug    text,
  gift_credit_id     uuid,
  gift_attendee_id   uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name  text := nullif(trim(coalesce(p_name, '')), '');
  v_event record;
  v_attendee record;
  v_credit record;
begin
  if v_email is null or v_email = '' then
    return query select
      'invalid_email'::text, null::text, null::uuid, null::text, null::text, null::uuid, null::uuid;
    return;
  end if;

  if p_source_event_id is not null then
    select e.* into v_event
    from public.events e
    where e.id = p_source_event_id;

    if not found then
      return query select
        'event_not_found'::text, null::text, null::uuid, null::text, null::text, null::uuid, null::uuid;
      return;
    end if;
  else
    -- Auto: oldest event (by event_date, then created_at) that still has leftovers
    select e.* into v_event
    from public.events e
    where exists (
      select 1
      from public.credit_links c
      where c.event_id = e.id
        and c.used = false
    )
    order by e.event_date asc nulls last, e.created_at asc
    limit 1;

    if not found then
      return query select
        'no_credits'::text, null::text, null::uuid, null::text, null::text, null::uuid, null::uuid;
      return;
    end if;
  end if;

  -- Upsert attendee on the source event (gifts are allowed for any email)
  select a.* into v_attendee
  from public.attendees a
  where a.event_id = v_event.id
    and lower(a.email) = v_email
  for update;

  if not found then
    insert into public.attendees as a (event_id, email, name)
    values (v_event.id, v_email, v_name)
    returning a.* into v_attendee;
  elsif v_name is not null and (v_attendee.name is null or v_attendee.name = '') then
    update public.attendees as a
       set name = v_name
     where a.id = v_attendee.id
    returning a.* into v_attendee;
  end if;

  select c.* into v_credit
  from public.credit_links c
  where c.event_id = v_event.id
    and c.used = false
  order by c.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return query select
      'no_credits'::text,
      null::text,
      v_event.id,
      v_event.name,
      v_event.slug,
      null::uuid,
      v_attendee.id;
    return;
  end if;

  update public.credit_links as c
     set used = true,
         assigned_to = v_attendee.id,
         assigned_at = now()
   where c.id = v_credit.id;

  -- Latest gift becomes the "current" credit for resend / click tracking
  update public.attendees as a
     set claimed = true,
         claimed_at = coalesce(a.claimed_at, now()),
         credit_id = v_credit.id,
         credit_email_sent_at = null,
         credit_link_clicked_at = null
   where a.id = v_attendee.id;

  return query select
    'success'::text,
    v_credit.cursor_url,
    v_event.id,
    v_event.name,
    v_event.slug,
    v_credit.id,
    v_attendee.id;
end;
$$;

revoke all on function public.gift_unused_credit(text, text, uuid) from public;
revoke all on function public.gift_unused_credit(text, text, uuid) from anon, authenticated;
grant execute on function public.gift_unused_credit(text, text, uuid) to service_role;
