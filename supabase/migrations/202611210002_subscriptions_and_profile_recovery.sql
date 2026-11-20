-- Ventora Connect subscriptions, tier entitlements and missing-profile recovery.
-- Applied to project nlkcnewcrcgylubqulph through Supabase SQL execution.

create table if not exists public.subscription_plans (
  id text primary key, account_type public.account_role not null, name text not null,
  price_inr numeric(10,2) not null check(price_inr>=0),
  billing_period text not null default 'month' check(billing_period='month'),
  description text not null default '', features jsonb not null default '{}'::jsonb,
  display_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'active' check(status in ('active','pending','cancelled','expired')),
  starts_at timestamptz not null default now(), ends_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  note text, created_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);
create index if not exists subscription_requests_status_created_idx on public.subscription_requests(status,created_at desc);
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_requests enable row level security;
drop policy if exists subscription_plans_read on public.subscription_plans;
create policy subscription_plans_read on public.subscription_plans for select to anon,authenticated using(is_active or public.is_admin());
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists subscriptions_admin_manage on public.subscriptions;
create policy subscriptions_admin_manage on public.subscriptions for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists subscription_requests_read on public.subscription_requests;
create policy subscription_requests_read on public.subscription_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists subscription_requests_create on public.subscription_requests;
create policy subscription_requests_create on public.subscription_requests for insert to authenticated with check(user_id=auth.uid() and status='pending');
drop policy if exists subscription_requests_admin_manage on public.subscription_requests;
create policy subscription_requests_admin_manage on public.subscription_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());

insert into public.subscription_plans(id,account_type,name,price_inr,description,features,display_order) values
('business_launch','business','Launch',0,'A tightly limited entry plan for businesses getting started.','{"max_business_profiles":1,"monthly_connections":1,"pitch_deck":false,"advanced_discovery":false,"analytics":false,"featured":false,"messaging":false,"investor_contacts":false,"networking":true,"monthly_profile_views":10,"priority_support":false}',1),
('business_growth','business','Growth',699,'More visibility, stronger discovery and practical investor tools.','{"max_business_profiles":1,"monthly_connections":25,"pitch_deck":true,"advanced_discovery":true,"analytics":true,"featured":false,"messaging":true,"investor_contacts":true,"networking":true,"monthly_profile_views":500,"priority_support":false}',2),
('business_scale','business','Scale',1699,'Full business networking power with priority visibility and advanced insights.','{"max_business_profiles":-1,"monthly_connections":-1,"pitch_deck":true,"advanced_discovery":true,"analytics":true,"featured":true,"messaging":true,"investor_contacts":true,"networking":true,"monthly_profile_views":-1,"priority_support":true}',3),
('investor_explorer','investor','Explorer',0,'A highly restricted preview of the Ventora network.','{"monthly_business_views":3,"saved_profiles":3,"messaging":false,"express_interest":false,"advanced_filters":false,"pitch_deck_access":false,"portfolio_access":false,"networking":false}',1),
('investor_access','investor','All Access',1,'Full access to Ventora discovery, networking and investor tools.','{"monthly_business_views":-1,"saved_profiles":-1,"messaging":true,"express_interest":true,"advanced_filters":true,"pitch_deck_access":true,"portfolio_access":true,"networking":true}',2)
on conflict(id) do update set name=excluded.name,price_inr=excluded.price_inr,description=excluded.description,features=excluded.features,display_order=excluded.display_order,is_active=true;

create or replace function public.current_plan_features() returns jsonb
language sql stable security invoker set search_path=public as $$
 select coalesce(
  (select p.features from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id
   where s.user_id=auth.uid() and s.status='active' and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) limit 1),
  (select p.features from public.subscription_plans p join public.profiles u on u.account_type=p.account_type
   where u.id=auth.uid() and p.id=case when u.account_type='business' then 'business_launch' else 'investor_explorer' end),
  '{}'::jsonb);
$$;
create or replace function public.plan_feature_enabled(feature_name text) returns boolean
language sql stable security invoker set search_path=public as $$
 select coalesce((public.current_plan_features()->>feature_name)::boolean,false);
$$;
grant execute on function public.current_plan_features() to authenticated;
grant execute on function public.plan_feature_enabled(text) to authenticated;

insert into public.subscriptions(user_id,plan_id,status)
select id,case when account_type='business' then 'business_launch' else 'investor_explorer' end,'active'
from public.profiles on conflict(user_id) do nothing;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare chosen_role public.account_role;
begin
 chosen_role:=coalesce((new.raw_user_meta_data->>'account_type')::public.account_role,'business');
 insert into public.profiles(id,full_name,account_type) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),chosen_role) on conflict(id) do nothing;
 if chosen_role='investor' then insert into public.investors(id) values(new.id) on conflict(id) do nothing; end if;
 insert into public.subscriptions(user_id,plan_id,status) values(new.id,case when chosen_role='business' then 'business_launch' else 'investor_explorer' end,'active') on conflict(user_id) do nothing;
 return new;
end; $$;

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check(id=auth.uid());
create or replace function public.prevent_profile_role_change() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.account_type is distinct from old.account_type and not public.is_admin() then raise exception 'Account type cannot be changed after registration'; end if;
 return new;
end; $$;
drop trigger if exists profiles_role_immutable on public.profiles;
create trigger profiles_role_immutable before update of account_type on public.profiles for each row execute function public.prevent_profile_role_change();
create unique index if not exists subscription_requests_one_pending_idx on public.subscription_requests(user_id,plan_id) where status='pending';

drop policy if exists connections_create on public.connections;
create policy connections_create on public.connections for insert to authenticated with check(
 requester_id=auth.uid() and public.is_active_member() and requester_id<>recipient_id and public.plan_feature_enabled('networking')
 and (coalesce((public.current_plan_features()->>'monthly_connections')::int,0)=-1
 or (select count(*) from public.connections c where c.requester_id=auth.uid() and c.created_at>=date_trunc('month',now())) < coalesce((public.current_plan_features()->>'monthly_connections')::int,0)));
drop policy if exists messages_member_send on public.messages;
create policy messages_member_send on public.messages for insert to authenticated with check(
 sender_id=auth.uid() and public.is_active_member() and public.plan_feature_enabled('messaging')
 and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid())
 and not exists(select 1 from public.conversation_members m join public.user_blocks b on
 ((b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid()))
 where m.conversation_id=messages.conversation_id and m.user_id<>auth.uid()));
drop policy if exists interests_investor_insert on public.investment_interests;
create policy interests_investor_insert on public.investment_interests for insert to authenticated with check(
 investor_id=auth.uid() and public.is_active_member() and public.plan_feature_enabled('express_interest'));

-- Enforce restrictive free-tier limits server-side.
update public.subscription_plans set features=features||'{"saved_profiles":3}'::jsonb where id in ('business_launch','investor_explorer');
update public.subscription_plans set features=features||'{"saved_profiles":50}'::jsonb where id='business_growth';
update public.subscription_plans set features=features||'{"saved_profiles":-1,"monthly_connections":-1}'::jsonb where id in ('business_scale','investor_access');

drop policy if exists saved_businesses_owner on public.saved_businesses;
drop policy if exists saved_businesses_read on public.saved_businesses;
drop policy if exists saved_businesses_insert on public.saved_businesses;
drop policy if exists saved_businesses_update on public.saved_businesses;
drop policy if exists saved_businesses_delete on public.saved_businesses;
create policy saved_businesses_read on public.saved_businesses for select to authenticated using(user_id=auth.uid() and public.is_active_member());
create policy saved_businesses_insert on public.saved_businesses for insert to authenticated with check(user_id=auth.uid() and public.is_active_member() and (coalesce((public.current_plan_features()->>'saved_profiles')::int,0)=-1 or (select count(*) from public.saved_businesses x where x.user_id=auth.uid())+(select count(*) from public.saved_investors x where x.user_id=auth.uid())<coalesce((public.current_plan_features()->>'saved_profiles')::int,0)));
create policy saved_businesses_update on public.saved_businesses for update to authenticated using(user_id=auth.uid() and public.is_active_member()) with check(user_id=auth.uid() and public.is_active_member());
create policy saved_businesses_delete on public.saved_businesses for delete to authenticated using(user_id=auth.uid() and public.is_active_member());

drop policy if exists saved_investors_owner on public.saved_investors;
drop policy if exists saved_investors_read on public.saved_investors;
drop policy if exists saved_investors_insert on public.saved_investors;
drop policy if exists saved_investors_update on public.saved_investors;
drop policy if exists saved_investors_delete on public.saved_investors;
create policy saved_investors_read on public.saved_investors for select to authenticated using(user_id=auth.uid() and public.is_active_member());
create policy saved_investors_insert on public.saved_investors for insert to authenticated with check(user_id=auth.uid() and public.is_active_member() and (coalesce((public.current_plan_features()->>'saved_profiles')::int,0)=-1 or (select count(*) from public.saved_businesses x where x.user_id=auth.uid())+(select count(*) from public.saved_investors x where x.user_id=auth.uid())<coalesce((public.current_plan_features()->>'saved_profiles')::int,0)));
create policy saved_investors_update on public.saved_investors for update to authenticated using(user_id=auth.uid() and public.is_active_member()) with check(user_id=auth.uid() and public.is_active_member());
create policy saved_investors_delete on public.saved_investors for delete to authenticated using(user_id=auth.uid() and public.is_active_member());

drop policy if exists profile_views_insert on public.profile_views;
create policy profile_views_insert on public.profile_views for insert to authenticated with check(viewer_id=auth.uid() and public.is_active_member() and (business_id is null or coalesce((select account_type from public.profiles where id=auth.uid()),'business'::public.account_role)<>'investor'::public.account_role or coalesce((public.current_plan_features()->>'monthly_business_views')::int,0)=-1 or (select count(*) from public.profile_views v where v.viewer_id=auth.uid() and v.business_id is not null and v.created_at>=date_trunc('month',now()))<coalesce((public.current_plan_features()->>'monthly_business_views')::int,0)));

drop policy if exists business_private_assets_owner_insert on public.business_private_assets;
create policy business_private_assets_owner_insert on public.business_private_assets for insert to authenticated with check((owner_id=auth.uid() and public.is_active_member() and public.plan_feature_enabled('pitch_deck')) or public.is_admin());
drop policy if exists business_private_assets_owner_update on public.business_private_assets;
create policy business_private_assets_owner_update on public.business_private_assets for update to authenticated using((owner_id=auth.uid() and public.is_active_member() and public.plan_feature_enabled('pitch_deck')) or public.is_admin()) with check((owner_id=auth.uid() and public.is_active_member() and public.plan_feature_enabled('pitch_deck')) or public.is_admin());

drop policy if exists businesses_owner_write on public.businesses;
drop policy if exists businesses_owner_insert on public.businesses;
drop policy if exists businesses_owner_update on public.businesses;
drop policy if exists businesses_owner_delete on public.businesses;
create policy businesses_owner_insert on public.businesses for insert to authenticated with check(owner_id=auth.uid() and public.is_active_member() and (coalesce((public.current_plan_features()->>'max_business_profiles')::int,0)=-1 or (select count(*) from public.businesses b where b.owner_id=auth.uid())<coalesce((public.current_plan_features()->>'max_business_profiles')::int,0)));
create policy businesses_owner_update on public.businesses for update to authenticated using((owner_id=auth.uid() and public.is_active_member()) or public.is_admin()) with check((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());
create policy businesses_owner_delete on public.businesses for delete to authenticated using((owner_id=auth.uid() and public.is_active_member()) or public.is_admin());
