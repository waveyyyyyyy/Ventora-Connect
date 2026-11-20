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
