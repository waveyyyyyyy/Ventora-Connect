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
