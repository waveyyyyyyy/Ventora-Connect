-- VENTORA CONNECT: first-time Supabase setup.
-- Run this entire file once in the SQL Editor of the Ventora Connect Supabase project.
-- Apply only to a fresh Ventora Connect database; review before production use.

-- ===== supabase/migrations/202611210001_initial_schema.sql =====
-- Ventora Connect initial schema. Apply through the Supabase SQL Editor after review.
create extension if not exists pgcrypto;
create type public.account_role as enum ('business','investor');
create type public.connection_status as enum ('pending','accepted','rejected','cancelled','blocked');
create type public.verification_status as enum ('not_submitted','pending','approved','rejected');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '', account_type public.account_role not null, avatar_url text, bio text, country text, city text, website text, linkedin_url text, is_suspended boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.businesses (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, company_name text not null, slug text unique, industry text, description text, website text, country text, city text, founded_year int, business_stage text, business_model text, funding_requirement numeric(14,2), min_investment numeric(14,2), max_investment numeric(14,2), equity_offered numeric(6,3), valuation numeric(16,2), pitch_deck_path text, is_published boolean not null default false, verification_status public.verification_status not null default 'not_submitted', featured boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.investors (id uuid primary key references public.profiles(id) on delete cascade, investment_min numeric(14,2), investment_max numeric(14,2), preferred_industries text[] not null default '{}', preferred_stages text[] not null default '{}', preferred_locations text[] not null default '{}', investment_strategy text, portfolio jsonb not null default '[]', verification_status public.verification_status not null default 'not_submitted', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.connections (id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id) on delete cascade, recipient_id uuid not null references public.profiles(id) on delete cascade, status public.connection_status not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(requester_id <> recipient_id), unique(requester_id,recipient_id));
create table public.conversations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), last_message_at timestamptz);
create table public.conversation_members (conversation_id uuid references public.conversations(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, joined_at timestamptz not null default now(), primary key(conversation_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade, sender_id uuid not null references public.profiles(id) on delete cascade, body text not null check(length(body) between 1 and 10000), attachment_path text, read_at timestamptz, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, type text not null, title text not null, body text, payload jsonb not null default '{}', read_at timestamptz, created_at timestamptz not null default now());
create table public.saved_businesses (user_id uuid references public.profiles(id) on delete cascade, business_id uuid references public.businesses(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,business_id));
create table public.saved_investors (user_id uuid references public.profiles(id) on delete cascade, investor_id uuid references public.investors(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,investor_id));
create table public.investment_interests (id uuid primary key default gen_random_uuid(), investor_id uuid not null references public.investors(id) on delete cascade, business_id uuid not null references public.businesses(id) on delete cascade, message text, status text not null default 'sent' check(status in ('sent','reviewing','interested','declined','withdrawn')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(investor_id,business_id));
create table public.profile_views (id uuid primary key default gen_random_uuid(), viewer_id uuid references public.profiles(id) on delete set null, business_id uuid references public.businesses(id) on delete cascade, viewed_profile_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), check(num_nonnulls(business_id,viewed_profile_id)=1));
create table public.verification_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, document_path text not null, status public.verification_status not null default 'pending', reviewer_id uuid references public.profiles(id), reviewer_note text, created_at timestamptz not null default now(), reviewed_at timestamptz);
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade, reported_user_id uuid references public.profiles(id) on delete set null, reason text not null, details text, status text not null default 'open', created_at timestamptz not null default now());
create table public.support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null, subject text not null, message text not null, status text not null default 'open', created_at timestamptz not null default now());
create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, body text not null, published boolean not null default false, created_at timestamptz not null default now());
create table public.admin_roles (user_id uuid primary key references public.profiles(id) on delete cascade, role text not null check(role in ('admin','moderator')), created_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table public.user_preferences (user_id uuid primary key references public.profiles(id) on delete cascade, notifications jsonb not null default '{}', visibility jsonb not null default '{}', discovery jsonb not null default '{}', updated_at timestamptz not null default now());
create index businesses_discovery_idx on public.businesses(is_published,industry,country,business_stage);
create index investors_discovery_idx on public.investors using gin(preferred_industries);
create index connections_recipient_status_idx on public.connections(recipient_id,status);
create index messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);
create index interests_business_status_idx on public.investment_interests(business_id,status);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,account_type) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce((new.raw_user_meta_data->>'account_type')::public.account_role,'business')); if coalesce(new.raw_user_meta_data->>'account_type','business')='investor' then insert into public.investors(id) values(new.id); end if; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_roles where user_id=auth.uid()) $$;
-- RLS enabled on all user-facing tables. Admin reads are deliberately scoped through is_admin().
do $$ declare t text; begin foreach t in array array['profiles','businesses','investors','connections','conversations','conversation_members','messages','notifications','saved_businesses','saved_investors','investment_interests','profile_views','verification_requests','reports','support_tickets','announcements','admin_roles','audit_logs','user_preferences'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profiles_read on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy businesses_public_read on public.businesses for select using(is_published or owner_id=auth.uid() or public.is_admin());
create policy businesses_owner_write on public.businesses for all using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());
create policy investors_read on public.investors for select using(id=auth.uid() or public.is_admin() or exists(select 1 from public.profiles p where p.id=investors.id));
create policy investors_owner_write on public.investors for all using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy connections_participants on public.connections for select using(requester_id=auth.uid() or recipient_id=auth.uid() or public.is_admin());
create policy connections_create on public.connections for insert with check(requester_id=auth.uid() and requester_id<>recipient_id);
create policy connections_update on public.connections for update using(requester_id=auth.uid() or recipient_id=auth.uid() or public.is_admin()) with check(requester_id=auth.uid() or recipient_id=auth.uid() or public.is_admin());
create policy conversation_members_read on public.conversation_members for select using(user_id=auth.uid() or public.is_admin());
create policy conversation_members_add on public.conversation_members for insert with check(user_id=auth.uid() or public.is_admin());
create policy conversations_member_read on public.conversations for select using(exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid()) or public.is_admin());
create policy messages_member_read on public.messages for select using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()) or public.is_admin());
create policy messages_member_send on public.messages for insert with check(sender_id=auth.uid() and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));
create policy notifications_owner on public.notifications for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy saved_businesses_owner on public.saved_businesses for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy saved_investors_owner on public.saved_investors for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy interests_participants on public.investment_interests for select using(investor_id=auth.uid() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()) or public.is_admin());
create policy interests_investor_insert on public.investment_interests for insert with check(investor_id=auth.uid());
create policy interests_participant_update on public.investment_interests for update using(investor_id=auth.uid() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()) or public.is_admin()) with check(investor_id=auth.uid() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()) or public.is_admin());
create policy profile_views_read on public.profile_views for select using(viewer_id=auth.uid() or viewed_profile_id=auth.uid() or public.is_admin());
create policy profile_views_insert on public.profile_views for insert with check(viewer_id=auth.uid());
create policy verification_private on public.verification_requests for select using(user_id=auth.uid() or public.is_admin());
create policy verification_submit on public.verification_requests for insert with check(user_id=auth.uid());
create policy reports_submit on public.reports for insert with check(reporter_id=auth.uid());
create policy reports_admin on public.reports for select using(reporter_id=auth.uid() or public.is_admin());
create policy support_submit on public.support_tickets for insert with check(user_id=auth.uid());
create policy support_read on public.support_tickets for select using(user_id=auth.uid() or public.is_admin());
create policy announcements_read on public.announcements for select using(published or public.is_admin());
create policy admin_roles_read on public.admin_roles for select using(user_id=auth.uid() or public.is_admin());
create policy audit_admin_read on public.audit_logs for select using(public.is_admin());
create policy preferences_owner on public.user_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
-- IMPORTANT: Create private Storage buckets and policies separately before enabling document uploads.


-- ===== supabase/migrations/202611210002_security_hardening.sql =====
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


-- ===== supabase/migrations/202611210003_discovery_view.sql =====
-- Public, intentionally limited discovery projection. Never expose auth email or private documents here.
create or replace view public.discoverable_profiles as
select p.id,p.full_name,p.bio,p.avatar_url,p.country,p.city,p.website,
       p.account_type,i.investment_min,i.investment_max,i.preferred_industries,
       i.preferred_stages
from public.profiles p
left join public.investors i on i.id=p.id
where p.is_suspended=false and (
  (p.account_type='investor' and i.id is not null)
  or exists(select 1 from public.businesses b where b.owner_id=p.id and b.is_published=true)
);
grant select on public.discoverable_profiles to anon, authenticated;


-- ===== supabase/migrations/202611210004_production_security_events.sql =====
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


-- ===== supabase/migrations/202611210005_interests_realtime.sql =====
-- Investment-interest state machine and Realtime publication.
create or replace function public.guard_interest_workflow() returns trigger
language plpgsql security invoker set search_path=public as $$
declare owner_user uuid;
begin
  if tg_op='INSERT' then
    if new.investor_id is distinct from auth.uid() and coalesce(auth.role(),'') <> 'service_role' then
      raise exception 'Only the investor can express interest';
    end if;
    new.status := 'sent';
    return new;
  end if;
  if new.investor_id is distinct from old.investor_id or new.business_id is distinct from old.business_id then
    raise exception 'Interest participants cannot be changed';
  end if;
  select owner_id into owner_user from public.businesses where id=old.business_id;
  if public.is_admin() or coalesce(auth.role(),'')='service_role' then
    return new;
  elsif auth.uid()=old.investor_id then
    if old.status not in ('sent','reviewing') or new.status<>'withdrawn' then
      raise exception 'Investors may only withdraw an active interest';
    end if;
  elsif auth.uid()=owner_user then
    if old.status not in ('sent','reviewing') or new.status not in ('reviewing','interested','declined') then
      raise exception 'Invalid business response to investment interest';
    end if;
  else
    raise exception 'Not authorised to update this interest';
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists guard_interest_workflow_before_write on public.investment_interests;
create trigger guard_interest_workflow_before_write before insert or update on public.investment_interests
for each row execute function public.guard_interest_workflow();

create or replace function public.notify_interest_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare business_owner uuid;
begin
  select owner_id into business_owner from public.businesses where id=new.business_id;
  if tg_op='INSERT' then
    insert into public.notifications(user_id,type,title,body,payload)
    values(business_owner,'investment_interest','New investor interest','An investor has expressed interest in your business.',jsonb_build_object('interest_id',new.id,'business_id',new.business_id));
  elsif new.status is distinct from old.status then
    if auth.uid()=business_owner or public.is_admin() then
      insert into public.notifications(user_id,type,title,body,payload)
      values(new.investor_id,'interest_update','Business responded to your interest','Your investment interest status was updated.',jsonb_build_object('interest_id',new.id,'business_id',new.business_id,'status',new.status));
    else
      insert into public.notifications(user_id,type,title,body,payload)
      values(business_owner,'interest_update','Investor updated their interest','An investor updated their interest status.',jsonb_build_object('interest_id',new.id,'business_id',new.business_id,'status',new.status));
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists investment_interest_notification_event on public.investment_interests;
create trigger investment_interest_notification_event after insert or update of status on public.investment_interests
for each row execute function public.notify_interest_event();

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;


-- ===== supabase/migrations/202611210006_private_storage.sql =====
-- Private document storage. Files must be stored under a first path segment equal to the member UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ventora-private-documents','ventora-private-documents',false,15728640,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ventora_private_documents_read on storage.objects;
create policy ventora_private_documents_read on storage.objects for select to authenticated
using(bucket_id='ventora-private-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

drop policy if exists ventora_private_documents_upload on storage.objects;
create policy ventora_private_documents_upload on storage.objects for insert to authenticated
with check(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists ventora_private_documents_update on storage.objects;
create policy ventora_private_documents_update on storage.objects for update to authenticated
using(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists ventora_private_documents_delete on storage.objects;
create policy ventora_private_documents_delete on storage.objects for delete to authenticated
using(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);


-- ===== supabase/migrations/202611210007_private_business_assets.sql =====
-- Separate private pitch-deck metadata from public business listing fields.
create table if not exists public.business_private_assets (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  pitch_deck_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_private_assets enable row level security;
drop policy if exists business_private_assets_owner_read on public.business_private_assets;
create policy business_private_assets_owner_read on public.business_private_assets
for select using(owner_id=auth.uid() or public.is_admin());
drop policy if exists business_private_assets_owner_insert on public.business_private_assets;
create policy business_private_assets_owner_insert on public.business_private_assets
for insert with check(owner_id=auth.uid() or public.is_admin());
drop policy if exists business_private_assets_owner_update on public.business_private_assets;
create policy business_private_assets_owner_update on public.business_private_assets
for update using(owner_id=auth.uid() or public.is_admin())
with check(owner_id=auth.uid() or public.is_admin());
drop policy if exists business_private_assets_owner_delete on public.business_private_assets;
create policy business_private_assets_owner_delete on public.business_private_assets
for delete using(owner_id=auth.uid() or public.is_admin());

insert into public.business_private_assets(business_id,owner_id,pitch_deck_path)
select id,owner_id,pitch_deck_path from public.businesses where pitch_deck_path is not null
on conflict(business_id) do update set pitch_deck_path=excluded.pitch_deck_path;
alter table public.businesses drop column if exists pitch_deck_path;

create or replace view public.discoverable_businesses as
select id,owner_id,company_name,slug,industry,description,website,country,city,
       founded_year,business_stage,business_model,funding_requirement,
       min_investment,max_investment,equity_offered,valuation,
       verification_status,featured,created_at,updated_at
from public.businesses
where is_published=true;
grant select on public.discoverable_businesses to anon,authenticated;


-- ===== supabase/migrations/202611210008_member_blocking.sql =====
-- Member blocking controls and communication boundaries.
create table if not exists public.user_blocks(
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id<>blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_read_own on public.user_blocks;
create policy user_blocks_read_own on public.user_blocks for select using(blocker_id=auth.uid());
drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks for insert with check(blocker_id=auth.uid());
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks for delete using(blocker_id=auth.uid());

create or replace function public.guard_connection_pair() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if exists(select 1 from public.user_blocks b where
    (b.blocker_id=new.requester_id and b.blocked_id=new.recipient_id)
    or (b.blocker_id=new.recipient_id and b.blocked_id=new.requester_id)) then
    raise exception 'Connection is unavailable';
  end if;
  if tg_op='INSERT' and exists(select 1 from public.connections c
    where c.requester_id=new.recipient_id and c.recipient_id=new.requester_id
      and c.status in ('pending','accepted')) then
    raise exception 'A connection request already exists between these members';
  end if;
  return new;
end; $$;

create or replace function public.start_conversation(target_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_conversation uuid;
begin
  if auth.uid() is null or target_user is null or target_user=auth.uid() then
    raise exception 'Invalid conversation participants';
  end if;
  if exists(select 1 from public.user_blocks b where
    (b.blocker_id=auth.uid() and b.blocked_id=target_user)
    or (b.blocker_id=target_user and b.blocked_id=auth.uid())) then
    raise exception 'Messaging is unavailable for this member';
  end if;
  if not exists(select 1 from public.connections c where c.status='accepted'
    and ((c.requester_id=auth.uid() and c.recipient_id=target_user)
      or (c.requester_id=target_user and c.recipient_id=auth.uid()))) then
    raise exception 'An accepted connection is required';
  end if;
  insert into public.conversations default values returning id into new_conversation;
  insert into public.conversation_members(conversation_id,user_id)
  values(new_conversation,auth.uid()),(new_conversation,target_user);
  return new_conversation;
end; $$;
revoke all on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

drop policy if exists messages_member_send on public.messages;
create policy messages_member_send on public.messages for insert
with check(sender_id=auth.uid()
  and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
  and not exists(select 1 from public.conversation_members m join public.user_blocks b
    on (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid())
    where m.conversation_id=messages.conversation_id and m.user_id<>auth.uid()));

drop policy if exists messages_member_read on public.messages;
create policy messages_member_read on public.messages for select
using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
  and not exists(select 1 from public.conversation_members m join public.user_blocks b
    on (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid())
    where m.conversation_id=messages.conversation_id and m.user_id<>auth.uid())
  or public.is_admin());

create or replace view public.discoverable_profiles as
select p.id,p.full_name,p.bio,p.avatar_url,p.country,p.city,p.website,
       p.account_type,i.investment_min,i.investment_max,i.preferred_industries,
       i.preferred_stages
from public.profiles p
left join public.investors i on i.id=p.id
where p.is_suspended=false and (
  (p.account_type='investor' and i.id is not null)
  or exists(select 1 from public.businesses b where b.owner_id=p.id and b.is_published=true)
) and (auth.uid() is null or not exists(select 1 from public.user_blocks b where
  (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=auth.uid())));
create or replace view public.discoverable_businesses as
select b.id,b.owner_id,b.company_name,b.slug,b.industry,b.description,b.website,b.country,b.city,
       b.founded_year,b.business_stage,b.business_model,b.funding_requirement,
       b.min_investment,b.max_investment,b.equity_offered,b.valuation,
       b.verification_status,b.featured,b.created_at,b.updated_at
from public.businesses b
where b.is_published=true and (auth.uid() is null or not exists(select 1 from public.user_blocks x where
  (x.blocker_id=auth.uid() and x.blocked_id=b.owner_id) or (x.blocker_id=b.owner_id and x.blocked_id=auth.uid())));
grant select on public.discoverable_profiles to anon,authenticated;
grant select on public.discoverable_businesses to anon,authenticated;


-- ===== supabase/migrations/202611210009_conversation_participant_visibility.sql =====
-- Allow participants to see the participant list of their own conversations only.
drop policy if exists conversation_members_read on public.conversation_members;
create policy conversation_members_read on public.conversation_members for select
using(user_id=auth.uid()
  or exists(select 1 from public.conversation_members mine
    where mine.conversation_id=conversation_members.conversation_id and mine.user_id=auth.uid())
  or public.is_admin());


-- ===== supabase/migrations/202611210010_suspension_enforcement.sql =====
-- Enforce suspended-account restrictions at the database boundary.
create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_suspended=false)
$$;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
using((id=auth.uid() and public.is_active_member()) or public.is_admin())
with check((id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read on public.businesses for select
using((is_published and exists(select 1 from public.profiles p where p.id=businesses.owner_id and p.is_suspended=false)) or owner_id=auth.uid() or public.is_admin());
drop policy if exists businesses_owner_write on public.businesses;
create policy businesses_owner_write on public.businesses for all
using((owner_id=auth.uid() and public.is_active_member()) or public.is_admin())
with check((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists investors_owner_write on public.investors;
create policy investors_owner_write on public.investors for all
using((id=auth.uid() and public.is_active_member()) or public.is_admin())
with check((id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists connections_participants on public.connections;
create policy connections_participants on public.connections for select
using(((requester_id=auth.uid() or recipient_id=auth.uid()) and public.is_active_member()) or public.is_admin());
drop policy if exists connections_create on public.connections;
create policy connections_create on public.connections for insert
with check(requester_id=auth.uid() and public.is_active_member() and requester_id<>recipient_id);
drop policy if exists connections_recipient_decision on public.connections;
create policy connections_recipient_decision on public.connections for update
using(recipient_id=auth.uid() and status='pending' and public.is_active_member())
with check(recipient_id=auth.uid() and status in ('accepted','rejected') and public.is_active_member());
drop policy if exists connections_requester_cancel on public.connections;
create policy connections_requester_cancel on public.connections for update
using(requester_id=auth.uid() and status='pending' and public.is_active_member())
with check(requester_id=auth.uid() and status='cancelled' and public.is_active_member());

drop policy if exists conversation_members_read on public.conversation_members;
create policy conversation_members_read on public.conversation_members for select
using(((user_id=auth.uid() or exists(select 1 from public.conversation_members mine
  where mine.conversation_id=conversation_members.conversation_id and mine.user_id=auth.uid()))
  and public.is_active_member()) or public.is_admin());

drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read on public.conversations for select
using((exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid())
  and public.is_active_member()) or public.is_admin());

drop policy if exists messages_member_read on public.messages;
create policy messages_member_read on public.messages for select
using((exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
  and public.is_active_member()
  and not exists(select 1 from public.conversation_members m join public.user_blocks b
    on (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid())
    where m.conversation_id=messages.conversation_id and m.user_id<>auth.uid()))
  or public.is_admin());
drop policy if exists messages_member_send on public.messages;
create policy messages_member_send on public.messages for insert
with check(sender_id=auth.uid() and public.is_active_member()
  and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
  and not exists(select 1 from public.conversation_members m join public.user_blocks b
    on (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid())
    where m.conversation_id=messages.conversation_id and m.user_id<>auth.uid()));
drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages for update
using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()) and public.is_active_member())
with check(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()) and public.is_active_member());

drop policy if exists notifications_owner on public.notifications;
create policy notifications_owner on public.notifications for all
using((user_id=auth.uid() and public.is_active_member()) or public.is_admin())
with check((user_id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists saved_businesses_owner on public.saved_businesses;
create policy saved_businesses_owner on public.saved_businesses for all
using(user_id=auth.uid() and public.is_active_member())
with check(user_id=auth.uid() and public.is_active_member());
drop policy if exists saved_investors_owner on public.saved_investors;
create policy saved_investors_owner on public.saved_investors for all
using(user_id=auth.uid() and public.is_active_member())
with check(user_id=auth.uid() and public.is_active_member());

drop policy if exists interests_participants on public.investment_interests;
create policy interests_participants on public.investment_interests for select
using(((investor_id=auth.uid() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()))
  and public.is_active_member()) or public.is_admin());
drop policy if exists interests_investor_insert on public.investment_interests;
create policy interests_investor_insert on public.investment_interests for insert
with check(investor_id=auth.uid() and public.is_active_member());
drop policy if exists interests_participant_update on public.investment_interests;
create policy interests_participant_update on public.investment_interests for update
using(((investor_id=auth.uid() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()))
  and public.is_active_member()) or public.is_admin())
with check(((investor_id=auth.uid() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()))
  and public.is_active_member()) or public.is_admin());

drop policy if exists profile_views_read on public.profile_views;
create policy profile_views_read on public.profile_views for select
using(((viewer_id=auth.uid() or viewed_profile_id=auth.uid()
  or exists(select 1 from public.businesses b where b.id=profile_views.business_id and b.owner_id=auth.uid()))
  and public.is_active_member()) or public.is_admin());
drop policy if exists profile_views_insert on public.profile_views;
create policy profile_views_insert on public.profile_views for insert
with check(viewer_id=auth.uid() and public.is_active_member());

drop policy if exists verification_private on public.verification_requests;
create policy verification_private on public.verification_requests for select
using((user_id=auth.uid() and public.is_active_member()) or public.is_admin());
drop policy if exists verification_submit on public.verification_requests;
create policy verification_submit on public.verification_requests for insert
with check(user_id=auth.uid() and public.is_active_member());

drop policy if exists reports_submit on public.reports;
create policy reports_submit on public.reports for insert
with check(reporter_id=auth.uid() and public.is_active_member());
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for select
using((reporter_id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists support_submit on public.support_tickets;
create policy support_submit on public.support_tickets for insert
with check(user_id=auth.uid() and public.is_active_member());
drop policy if exists support_read on public.support_tickets;
create policy support_read on public.support_tickets for select
using((user_id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists preferences_owner on public.user_preferences;
create policy preferences_owner on public.user_preferences for all
using(user_id=auth.uid() and public.is_active_member())
with check(user_id=auth.uid() and public.is_active_member());

drop policy if exists business_private_assets_owner_read on public.business_private_assets;
create policy business_private_assets_owner_read on public.business_private_assets for select
using((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());
drop policy if exists business_private_assets_owner_insert on public.business_private_assets;
create policy business_private_assets_owner_insert on public.business_private_assets for insert
with check((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());
drop policy if exists business_private_assets_owner_update on public.business_private_assets;
create policy business_private_assets_owner_update on public.business_private_assets for update
using((owner_id=auth.uid() and public.is_active_member()) or public.is_admin())
with check((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());
drop policy if exists business_private_assets_owner_delete on public.business_private_assets;
create policy business_private_assets_owner_delete on public.business_private_assets for delete
using((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());

drop policy if exists ventora_private_documents_read on storage.objects;
create policy ventora_private_documents_read on storage.objects for select to authenticated
using(bucket_id='ventora-private-documents' and ((storage.foldername(name))[1]=auth.uid()::text and public.is_active_member() or public.is_admin()));
drop policy if exists ventora_private_documents_upload on storage.objects;
create policy ventora_private_documents_upload on storage.objects for insert to authenticated
with check(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active_member());
drop policy if exists ventora_private_documents_update on storage.objects;
create policy ventora_private_documents_update on storage.objects for update to authenticated
using(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active_member())
with check(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active_member());
drop policy if exists ventora_private_documents_delete on storage.objects;
create policy ventora_private_documents_delete on storage.objects for delete to authenticated
using(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active_member());

create or replace view public.discoverable_businesses as
select b.id,b.owner_id,b.company_name,b.slug,b.industry,b.description,b.website,b.country,b.city,
       b.founded_year,b.business_stage,b.business_model,b.funding_requirement,
       b.min_investment,b.max_investment,b.equity_offered,b.valuation,
       b.verification_status,b.featured,b.created_at,b.updated_at
from public.businesses b join public.profiles p on p.id=b.owner_id
where b.is_published=true and p.is_suspended=false
  and (auth.uid() is null or not exists(select 1 from public.user_blocks x where
    (x.blocker_id=auth.uid() and x.blocked_id=b.owner_id) or (x.blocker_id=b.owner_id and x.blocked_id=auth.uid())));
grant select on public.discoverable_businesses to anon,authenticated;
