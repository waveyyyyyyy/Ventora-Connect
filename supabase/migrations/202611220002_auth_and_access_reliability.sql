-- Ventora Connect: auth/session, profile-view recursion, admin RPC and index fixes.
-- Apply after the existing 202611220001 migration.

-- Private helper avoids reading profile_views from its own INSERT RLS policy.
CREATE OR REPLACE FUNCTION private.count_monthly_business_views(p_viewer_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT count(*)::integer
  FROM public.profile_views AS pv
  WHERE p_viewer_id = (SELECT auth.uid())
    AND pv.viewer_id = p_viewer_id
    AND pv.business_id IS NOT NULL
    AND pv.created_at >= date_trunc('month', now());
$function$;

REVOKE ALL ON FUNCTION private.count_monthly_business_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.count_monthly_business_views(uuid) TO authenticated;

DROP POLICY IF EXISTS profile_views_insert ON public.profile_views;
CREATE POLICY profile_views_insert
ON public.profile_views
FOR INSERT
TO authenticated
WITH CHECK (
  viewer_id = (SELECT auth.uid())
  AND (SELECT public.is_active_member())
  AND (
    business_id IS NULL
    OR COALESCE(
      (SELECT p.account_type FROM public.profiles AS p WHERE p.id = (SELECT auth.uid())),
      'business'::public.account_role
    ) <> 'investor'::public.account_role
    OR COALESCE(((SELECT public.current_plan_features())->>'monthly_business_views')::integer, 0) = -1
    OR (SELECT private.count_monthly_business_views((SELECT auth.uid())))
       < COALESCE(((SELECT public.current_plan_features())->>'monthly_business_views')::integer, 0)
  )
);

-- The admin RPC returns email as text; auth.users.email is varchar(255).
CREATE OR REPLACE FUNCTION public.admin_user_directory()
RETURNS TABLE(
  id uuid,
  member_number bigint,
  email text,
  full_name text,
  account_type text,
  avatar_url text,
  bio text,
  country text,
  city text,
  website text,
  linkedin_url text,
  is_suspended boolean,
  created_at timestamp with time zone,
  businesses jsonb,
  investor_details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    p.member_number,
    u.email::text,
    p.full_name::text,
    p.account_type::text,
    p.avatar_url::text,
    p.bio::text,
    p.country::text,
    p.city::text,
    p.website::text,
    p.linkedin_url::text,
    p.is_suspended,
    p.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'company_name', b.company_name,
        'industry', b.industry,
        'description', b.description,
        'website', b.website,
        'city', b.city,
        'country', b.country,
        'business_stage', b.business_stage,
        'funding_requirement', b.funding_requirement,
        'min_investment', b.min_investment,
        'max_investment', b.max_investment,
        'is_published', b.is_published,
        'verification_status', b.verification_status,
        'created_at', b.created_at
      ) ORDER BY b.created_at DESC)
      FROM public.businesses AS b
      WHERE b.owner_id = u.id
    ), '[]'::jsonb),
    CASE WHEN i.id IS NULL THEN NULL ELSE to_jsonb(i) END
  FROM auth.users AS u
  LEFT JOIN public.profiles AS p ON p.id = u.id
  LEFT JOIN public.investors AS i ON i.id = u.id
  ORDER BY lower(coalesce(u.email::text, '')), u.email::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;

-- Keep private conversation membership inaccessible to anonymous clients.
REVOKE SELECT ON TABLE public.conversation_members FROM anon;

-- Cover the foreign keys used by workspace, messaging, discovery and admin pages.
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS business_documents_business_id_idx ON public.business_documents(business_id);
CREATE INDEX IF NOT EXISTS business_documents_owner_id_idx ON public.business_documents(owner_id);
CREATE INDEX IF NOT EXISTS business_gallery_images_business_id_sort_order_idx ON public.business_gallery_images(business_id, sort_order);
CREATE INDEX IF NOT EXISTS business_gallery_images_owner_id_idx ON public.business_gallery_images(owner_id);
CREATE INDEX IF NOT EXISTS business_private_assets_owner_id_idx ON public.business_private_assets(owner_id);
CREATE INDEX IF NOT EXISTS businesses_owner_id_created_at_idx ON public.businesses(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_members_user_id_conversation_id_idx ON public.conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS profile_views_business_id_idx ON public.profile_views(business_id);
CREATE INDEX IF NOT EXISTS profile_views_viewed_profile_id_idx ON public.profile_views(viewed_profile_id);
CREATE INDEX IF NOT EXISTS profile_views_viewer_id_created_at_idx ON public.profile_views(viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS saved_businesses_business_id_idx ON public.saved_businesses(business_id);
CREATE INDEX IF NOT EXISTS saved_investors_investor_id_idx ON public.saved_investors(investor_id);
CREATE INDEX IF NOT EXISTS subscription_requests_plan_id_idx ON public.subscription_requests(plan_id);
CREATE INDEX IF NOT EXISTS subscription_requests_reviewed_by_idx ON public.subscription_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS verification_requests_reviewer_id_idx ON public.verification_requests(reviewer_id);
CREATE INDEX IF NOT EXISTS verification_requests_user_id_created_at_idx ON public.verification_requests(user_id, created_at DESC);
