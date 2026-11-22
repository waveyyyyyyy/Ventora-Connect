-- Move public discovery views and privileged RPC implementations behind
-- SECURITY INVOKER public wrappers. The only SECURITY DEFINER code remains in
-- the non-exposed private schema and returns explicitly filtered data.

CREATE OR REPLACE FUNCTION private.discoverable_profiles()
RETURNS TABLE(
  id uuid, full_name text, bio text, avatar_url text, country text, city text,
  website text, account_type public.account_role, investment_min numeric,
  investment_max numeric, preferred_industries text[], preferred_stages text[],
  member_number bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id,p.full_name,p.bio,p.avatar_url,p.country,p.city,p.website,p.account_type,
         i.investment_min,i.investment_max,i.preferred_industries,i.preferred_stages,p.member_number
  FROM public.profiles AS p
  LEFT JOIN public.investors AS i ON i.id=p.id
  WHERE p.is_suspended=false
    AND ((p.account_type='investor'::public.account_role AND i.id IS NOT NULL)
      OR EXISTS(SELECT 1 FROM public.businesses AS b WHERE b.owner_id=p.id AND b.is_published=true))
    AND ((SELECT auth.uid()) IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.user_blocks AS x
      WHERE (x.blocker_id=(SELECT auth.uid()) AND x.blocked_id=p.id)
         OR (x.blocker_id=p.id AND x.blocked_id=(SELECT auth.uid()))
    ));
$function$;

CREATE OR REPLACE FUNCTION private.discoverable_businesses()
RETURNS TABLE(
  id uuid, owner_id uuid, company_name text, slug text, industry text, description text,
  website text, country text, city text, founded_year integer, business_stage text,
  business_model text, funding_requirement numeric, min_investment numeric,
  max_investment numeric, equity_offered numeric, valuation numeric,
  verification_status public.verification_status, featured boolean,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  logo_url text, cover_image_url text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT b.id,b.owner_id,b.company_name,b.slug,b.industry,b.description,b.website,b.country,b.city,
         b.founded_year,b.business_stage,b.business_model,b.funding_requirement,b.min_investment,
         b.max_investment,b.equity_offered,b.valuation,b.verification_status,b.featured,
         b.created_at,b.updated_at,b.logo_url,b.cover_image_url
  FROM public.businesses AS b
  JOIN public.profiles AS p ON p.id=b.owner_id
  WHERE b.is_published=true AND p.is_suspended=false
    AND ((SELECT auth.uid()) IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.user_blocks AS x
      WHERE (x.blocker_id=(SELECT auth.uid()) AND x.blocked_id=b.owner_id)
         OR (x.blocker_id=b.owner_id AND x.blocked_id=(SELECT auth.uid()))
    ));
$function$;

REVOKE ALL ON FUNCTION private.discoverable_profiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.discoverable_businesses() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.discoverable_profiles() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.discoverable_businesses() TO anon, authenticated;

CREATE OR REPLACE VIEW public.discoverable_profiles
WITH (security_invoker = true)
AS
SELECT
  d.id,d.full_name,d.bio,d.avatar_url,d.country,d.city,d.website,d.account_type,
  d.investment_min::numeric(14,2) AS investment_min,
  d.investment_max::numeric(14,2) AS investment_max,
  d.preferred_industries,d.preferred_stages,d.member_number
FROM private.discoverable_profiles() AS d;

CREATE OR REPLACE VIEW public.discoverable_businesses
WITH (security_invoker = true)
AS
SELECT
  d.id,d.owner_id,d.company_name,d.slug,d.industry,d.description,d.website,d.country,d.city,
  d.founded_year,d.business_stage,d.business_model,
  d.funding_requirement::numeric(14,2) AS funding_requirement,
  d.min_investment::numeric(14,2) AS min_investment,
  d.max_investment::numeric(14,2) AS max_investment,
  d.equity_offered::numeric(6,3) AS equity_offered,
  d.valuation::numeric(16,2) AS valuation,
  d.verification_status,d.featured,d.created_at,d.updated_at,d.logo_url,d.cover_image_url
FROM private.discoverable_businesses() AS d;

GRANT SELECT ON public.discoverable_profiles, public.discoverable_businesses TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id=(SELECT auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION private.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_suspended=false);
$function$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_active_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_member() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$ SELECT private.is_admin(); $function$;

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$ SELECT private.is_active_member(); $function$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.business_owner_profile_count(p_owner uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT count(*)::integer FROM public.businesses WHERE owner_id=p_owner;
$function$;

REVOKE ALL ON FUNCTION private.business_owner_profile_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.business_owner_profile_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_owner_profile_count(p_owner uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_owner=(SELECT auth.uid()) OR private.is_admin()
    THEN private.business_owner_profile_count(p_owner)
    ELSE 0
  END;
$function$;

REVOKE EXECUTE ON FUNCTION public.business_owner_profile_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_owner_profile_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.select_account_type(p_account_type text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_profile public.profiles;
  v_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to choose an account type';
  END IF;
  IF p_account_type NOT IN ('business','investor') THEN
    RAISE EXCEPTION 'Choose either Business or Investor';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_user_id FOR UPDATE;
  IF FOUND THEN
    IF v_profile.account_type_selected THEN
      RAISE EXCEPTION 'Your account type has already been selected and cannot be changed';
    END IF;
    PERFORM set_config('app.account_type_selection_user',v_user_id::text,true);
    UPDATE public.profiles
      SET account_type=p_account_type::public.account_role,account_type_selected=true,updated_at=now()
      WHERE id=v_user_id RETURNING * INTO v_profile;
  ELSE
    SELECT coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name','')
      INTO v_name FROM auth.users WHERE id=v_user_id;
    INSERT INTO public.profiles(id,full_name,account_type,account_type_selected)
      VALUES(v_user_id,coalesce(v_name,''),p_account_type::public.account_role,true)
      RETURNING * INTO v_profile;
  END IF;
  RETURN v_profile;
END;
$function$;

REVOKE ALL ON FUNCTION private.select_account_type(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.select_account_type(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.select_account_type(p_account_type text)
RETURNS public.profiles LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $function$ SELECT private.select_account_type(p_account_type); $function$;

REVOKE EXECUTE ON FUNCTION public.select_account_type(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_account_type(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.start_conversation(target_user uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  new_conversation uuid;
  existing_conversation uuid;
BEGIN
  IF v_user_id IS NULL OR target_user IS NULL OR target_user=v_user_id THEN
    RAISE EXCEPTION 'Invalid conversation participants';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id=v_user_id AND b.blocked_id=target_user)
       OR (b.blocker_id=target_user AND b.blocked_id=v_user_id)
  ) THEN
    RAISE EXCEPTION 'Messaging is unavailable for this member';
  END IF;
  SELECT cm.conversation_id INTO existing_conversation
  FROM public.conversation_members cm
  WHERE cm.user_id=v_user_id
    AND EXISTS (SELECT 1 FROM public.conversation_members other
      WHERE other.conversation_id=cm.conversation_id AND other.user_id=target_user)
  LIMIT 1;
  IF existing_conversation IS NOT NULL THEN RETURN existing_conversation; END IF;
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conversation;
  INSERT INTO public.conversation_members(conversation_id,user_id)
    VALUES(new_conversation,v_user_id),(new_conversation,target_user);
  RETURN new_conversation;
END;
$function$;

REVOKE ALL ON FUNCTION private.start_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.start_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_conversation(target_user uuid)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $function$ SELECT private.start_conversation(target_user); $function$;

REVOKE EXECUTE ON FUNCTION public.start_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_user_directory()
RETURNS TABLE(
  id uuid, member_number bigint, email text, full_name text, account_type text,
  avatar_url text, bio text, country text, city text, website text, linkedin_url text,
  is_suspended boolean, created_at timestamp with time zone, businesses jsonb,
  investor_details jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  RETURN QUERY
  SELECT u.id,p.member_number,u.email::text,p.full_name::text,p.account_type::text,
         p.avatar_url::text,p.bio::text,p.country::text,p.city::text,p.website::text,
         p.linkedin_url::text,p.is_suspended,p.created_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id',b.id,'company_name',b.company_name,'industry',b.industry,
             'description',b.description,'website',b.website,'city',b.city,
             'country',b.country,'business_stage',b.business_stage,
             'funding_requirement',b.funding_requirement,'min_investment',b.min_investment,
             'max_investment',b.max_investment,'is_published',b.is_published,
             'verification_status',b.verification_status,'created_at',b.created_at
           ) ORDER BY b.created_at DESC)
           FROM public.businesses b WHERE b.owner_id=u.id
         ),'[]'::jsonb),
         CASE WHEN i.id IS NULL THEN NULL ELSE to_jsonb(i) END
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id=u.id
  LEFT JOIN public.investors i ON i.id=u.id
  ORDER BY lower(coalesce(u.email::text,'')),u.email::text;
END;
$function$;

REVOKE ALL ON FUNCTION private.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_user_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_directory()
RETURNS TABLE(
  id uuid, member_number bigint, email text, full_name text, account_type text,
  avatar_url text, bio text, country text, city text, website text, linkedin_url text,
  is_suspended boolean, created_at timestamp with time zone, businesses jsonb,
  investor_details jsonb
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$ SELECT * FROM private.admin_user_directory(); $function$;

REVOKE EXECUTE ON FUNCTION public.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;
