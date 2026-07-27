-- =============================================================================
-- REISSUE CREDIT MIGRATION
-- Burns the attendee's current credit URL (does NOT return it to the pool)
-- and assigns a fresh unused credit from the same event.
--
-- Use when a guest's old Cursor URL is already redeemed / dead, or they got
-- stuck on "already claimed" with a bad link. Run once in Supabase SQL editor.
-- =============================================================================

alter table public.attendees
  add column if not exists credit_email_sent_at timestamptz;

alter table public.attendees
  add column if not exists credit_link_clicked_at timestamptz;

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

  -- Burn the old URL: keep used=true so it never re-enters the unused pool.
  if v_old_credit_id is not null then
    update public.credit_links
       set assigned_to = null,
           assigned_at = null,
           used = true
     where id = v_old_credit_id;
  end if;

  -- Clear claim so we can assign a fresh unused credit.
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
