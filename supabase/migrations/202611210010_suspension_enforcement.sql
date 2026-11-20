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
