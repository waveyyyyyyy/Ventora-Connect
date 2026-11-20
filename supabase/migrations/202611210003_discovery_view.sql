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
