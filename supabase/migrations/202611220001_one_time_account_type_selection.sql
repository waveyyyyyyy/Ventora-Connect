-- One-time account type onboarding. Existing members keep their current role;
-- newly-created profiles start unselected and can choose exactly once.
alter table public.profiles
  add column if not exists account_type_selected boolean not null default false;

update public.profiles
set account_type_selected = true
where account_type_selected = false
  and created_at < timestamptz '2026-11-22 10:00:00+00';

update public.profiles p
set account_type_selected = false
from auth.users u
where u.id = p.id
  and p.created_at >= timestamptz '2026-11-22 10:00:00+00'
  and coalesce(u.raw_user_meta_data->>'account_type','') not in ('business','investor');

create or replace function public.guard_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_role_selection boolean := (
    old.account_type_selected = false
    and new.account_type_selected = true
    and current_setting('app.account_type_selection_user', true) = old.id::text
  );
begin
  if auth.uid() = old.id and coalesce(auth.role(),'') <> 'service_role' then
    if new.account_type is distinct from old.account_type and not v_role_selection then
      raise exception 'Account type cannot be changed';
    end if;
    if new.is_suspended is distinct from old.is_suspended then
      raise exception 'Account status is managed by Ventora';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_role_selection boolean := (
    old.account_type_selected = false
    and new.account_type_selected = true
    and current_setting('app.account_type_selection_user', true) = old.id::text
  );
begin
  if new.account_type is distinct from old.account_type
     and not v_role_selection
     and not public.is_admin() then
    raise exception 'Account type cannot be changed after registration';
  end if;
  return new;
end;
$function$;

create or replace function public.select_account_type(p_account_type text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to choose an account type';
  end if;
  if p_account_type not in ('business','investor') then
    raise exception 'Choose either Business or Investor';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if found then
    if v_profile.account_type_selected then
      raise exception 'Your account type has already been selected and cannot be changed';
    end if;
    perform set_config('app.account_type_selection_user', v_user_id::text, true);
    update public.profiles
    set account_type = p_account_type::public.account_role,
        account_type_selected = true,
        updated_at = now()
    where id = v_user_id
    returning * into v_profile;
  else
    select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
    into v_name
    from auth.users where id = v_user_id;
    insert into public.profiles (id, full_name, account_type, account_type_selected)
    values (v_user_id, coalesce(v_name,''), p_account_type::public.account_role, true)
    returning * into v_profile;
  end if;
  return v_profile;
end;
$function$;

revoke all on function public.select_account_type(text) from public, anon;
grant execute on function public.select_account_type(text) to authenticated;
