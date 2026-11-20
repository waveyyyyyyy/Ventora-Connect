-- Security hardening for Ventora Connect. Apply after 202611210001_initial_schema.sql.
-- Protect system-managed fields from ordinary profile owners.
create or replace function public.guard_profile_fields() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() = old.id and coalesce(auth.role(),'') <> 'service_role' then
    if new.account_type <> old.account_type then raise exception 'Account type cannot be changed'; end if;
    if new.is_suspended <> old.is_suspended then raise exception 'Account status is managed by Ventora'; end if;
  end if;
  return new;
end; $$;
create trigger guard_profile_fields_before_update before update on public.profiles
for each row execute function public.guard_profile_fields();

create or replace function public.guard_business_system_fields() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() = old.owner_id and coalesce(auth.role(),'') <> 'service_role' then
    if new.owner_id <> old.owner_id or new.verification_status <> old.verification_status or new.featured <> old.featured then
      raise exception 'Owner, verification and featured status are managed by Ventora';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_business_system_fields_before_update before update on public.businesses
for each row execute function public.guard_business_system_fields();

create or replace function public.guard_investor_system_fields() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() = old.id and coalesce(auth.role(),'') <> 'service_role' and new.verification_status <> old.verification_status then
    raise exception 'Verification status is managed by Ventora';
  end if;
  return new;
end; $$;
create trigger guard_investor_system_fields_before_update before update on public.investors
for each row execute function public.guard_investor_system_fields();

-- Replace permissive connection updates with state-specific transitions.
drop policy if exists connections_update on public.connections;
create policy connections_recipient_decision on public.connections for update
using (recipient_id = auth.uid() and status = 'pending')
with check (recipient_id = auth.uid() and status in ('accepted','rejected'));
create policy connections_requester_cancel on public.connections for update
using (requester_id = auth.uid() and status = 'pending')
with check (requester_id = auth.uid() and status = 'cancelled');

-- Conversations may only be created through the checked RPC below. Users cannot add themselves
-- to arbitrary conversations by inserting conversation_members rows directly.
drop policy if exists conversation_members_add on public.conversation_members;
create or replace function public.start_conversation(target_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_conversation uuid;
begin
  if auth.uid() is null or target_user is null or target_user = auth.uid() then
    raise exception 'Invalid conversation participants';
  end if;
  if not exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = auth.uid() and c.recipient_id = target_user)
        or (c.requester_id = target_user and c.recipient_id = auth.uid()))
  ) then raise exception 'An accepted connection is required'; end if;
  insert into public.conversations default values returning id into new_conversation;
  insert into public.conversation_members(conversation_id,user_id)
  values (new_conversation,auth.uid()),(new_conversation,target_user);
  return new_conversation;
end; $$;
revoke all on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Message authors cannot spoof another sender. Only participants can mark messages read.
create policy messages_mark_read on public.messages for update
using (exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));

-- Users may submit their own support/report records, but only moderators/admins may change review state.
create policy reports_admin_update on public.reports for update using (public.is_admin()) with check (public.is_admin());
create policy support_admin_update on public.support_tickets for update using (public.is_admin()) with check (public.is_admin());
create policy announcements_admin_manage on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_insert on public.audit_logs for insert with check (public.is_admin());

-- Ensure users cannot read other members' private identity documents through the table.
-- Verification requests remain visible only to their owner and authorised reviewers as defined in migration 001.
