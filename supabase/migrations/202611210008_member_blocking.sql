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
