-- Ventora Connect production security and event workflows.
-- Apply after migrations 001-003 in order.

-- Investor strategy and portfolio data is private; the public directory uses the restricted view.
drop policy if exists investors_read on public.investors;
create policy investors_owner_or_admin_read on public.investors
for select using (id=auth.uid() or public.is_admin());

-- A company owner may see analytics for their own listing.
drop policy if exists profile_views_read on public.profile_views;
create policy profile_views_read on public.profile_views for select
using (viewer_id=auth.uid() or viewed_profile_id=auth.uid()
  or exists(select 1 from public.businesses b where b.id=profile_views.business_id and b.owner_id=auth.uid())
  or public.is_admin());

-- System-owned state must never be supplied by a normal account on INSERT.
create or replace function public.guard_business_fields() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_admin() then
    if tg_op='INSERT' then
      if new.owner_id is distinct from auth.uid() then raise exception 'Invalid business owner'; end if;
      new.verification_status := 'not_submitted';
      new.featured := false;
    else
      if new.owner_id is distinct from old.owner_id then raise exception 'Business owner cannot be changed'; end if;
      if new.verification_status is distinct from old.verification_status or new.featured is distinct from old.featured then
        raise exception 'Verification and featured status are managed by Ventora';
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_business_system_fields_before_update on public.businesses;
drop trigger if exists guard_business_fields_before_write on public.businesses;
create trigger guard_business_fields_before_write before insert or update on public.businesses
for each row execute function public.guard_business_fields();

create or replace function public.guard_investor_fields() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_admin() then
    if tg_op='INSERT' then
      if new.id is distinct from auth.uid() then raise exception 'Invalid investor owner'; end if;
      new.verification_status := 'not_submitted';
    elsif new.id is distinct from old.id or new.verification_status is distinct from old.verification_status then
      raise exception 'Investor identity and verification are managed by Ventora';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_investor_system_fields_before_update on public.investors;
drop trigger if exists guard_investor_fields_before_write on public.investors;
create trigger guard_investor_fields_before_write before insert or update on public.investors
for each row execute function public.guard_investor_fields();

-- Verification documents always enter the review queue; only admins can change review decisions.
create or replace function public.guard_verification_request() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_admin() then
    if tg_op='INSERT' then
      if new.user_id is distinct from auth.uid() then raise exception 'Invalid verification owner'; end if;
      new.status := 'pending';
      new.reviewer_id := null;
      new.reviewer_note := null;
      new.reviewed_at := null;
    else
      raise exception 'Verification decisions are managed by Ventora reviewers';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_verification_request_before_write on public.verification_requests;
create trigger guard_verification_request_before_write before insert or update on public.verification_requests
for each row execute function public.guard_verification_request();
create policy verification_admin_update on public.verification_requests for update
using (public.is_admin()) with check (public.is_admin());

-- Prevent reverse-direction duplicate connection requests.
create or replace function public.guard_connection_pair() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if tg_op='INSERT' and exists(
    select 1 from public.connections c
    where c.requester_id=new.recipient_id and c.recipient_id=new.requester_id
      and c.status in ('pending','accepted')
  ) then raise exception 'A connection request already exists between these members'; end if;
  return new;
end; $$;
drop trigger if exists guard_connection_pair_before_insert on public.connections;
create trigger guard_connection_pair_before_insert before insert on public.connections
for each row execute function public.guard_connection_pair();

-- Users can mark messages as read, but cannot edit message content or impersonate a sender.
create or replace function public.guard_message_update() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.attachment_path is distinct from old.attachment_path
    or new.created_at is distinct from old.created_at then
    raise exception 'Messages cannot be edited after sending';
  end if;
  return new;
end; $$;
drop trigger if exists guard_message_update_before_write on public.messages;
create trigger guard_message_update_before_write before update on public.messages
for each row execute function public.guard_message_update();

-- Notifications are generated server-side from trusted database events.
create or replace function public.notify_connection_event() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(user_id,type,title,body,payload)
    values(new.recipient_id,'connection_request','New connection request','Someone wants to connect with you.',jsonb_build_object('connection_id',new.id,'from_user',new.requester_id));
  elsif new.status is distinct from old.status and new.status='accepted' then
    insert into public.notifications(user_id,type,title,body,payload)
    values(new.requester_id,'connection_accepted','Connection accepted','Your connection request was accepted.',jsonb_build_object('connection_id',new.id,'from_user',new.recipient_id));
  elsif new.status is distinct from old.status and new.status='rejected' then
    insert into public.notifications(user_id,type,title,body,payload)
    values(new.requester_id,'connection_rejected','Connection request update','Your connection request was declined.',jsonb_build_object('connection_id',new.id));
  end if;
  return new;
end; $$;
drop trigger if exists connection_notification_event on public.connections;
create trigger connection_notification_event after insert or update of status on public.connections
for each row execute function public.notify_connection_event();

create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,type,title,body,payload)
  select m.user_id,'new_message','New message','You received a new message.',jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id)
  from public.conversation_members m
  where m.conversation_id=new.conversation_id and m.user_id<>new.sender_id;
  update public.conversations set last_message_at=new.created_at where id=new.conversation_id;
  return new;
end; $$;
drop trigger if exists message_notification_event on public.messages;
create trigger message_notification_event after insert on public.messages
for each row execute function public.notify_new_message();

-- Safe account bootstrap: ignore untrusted metadata values outside the two supported account types.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare selected_role public.account_role;
begin
  selected_role := case when new.raw_user_meta_data->>'account_type'='investor'
    then 'investor'::public.account_role else 'business'::public.account_role end;
  insert into public.profiles(id,full_name,account_type)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),selected_role);
  if selected_role='investor' then insert into public.investors(id) values(new.id); end if;
  insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;
  return new;
end; $$;
