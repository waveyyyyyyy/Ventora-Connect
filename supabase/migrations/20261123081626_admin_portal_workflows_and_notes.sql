-- Admin portal operational fields and narrowly scoped admin actions.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS resolution_note text;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS admin_replied_at timestamptz;

CREATE OR REPLACE FUNCTION private.admin_set_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin_count integer;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_user_id IS NULL OR p_role NOT IN ('admin','moderator','none') THEN
    RAISE EXCEPTION 'Choose a valid member and role';
  END IF;
  IF p_role = 'none' THEN
    IF p_user_id = (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'You cannot remove your own administrator access';
    END IF;
    SELECT count(*) INTO v_admin_count FROM public.admin_roles WHERE role = 'admin';
    IF EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id=p_user_id AND role='admin') AND v_admin_count <= 1 THEN
      RAISE EXCEPTION 'The last administrator cannot be removed';
    END IF;
    DELETE FROM public.admin_roles WHERE user_id=p_user_id;
  ELSE
    INSERT INTO public.admin_roles(user_id,role)
    VALUES(p_user_id,p_role)
    ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  VALUES((SELECT auth.uid()),'admin_role_changed','member',p_user_id,
    jsonb_build_object('role',p_role));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$ SELECT private.admin_set_role(p_user_id,p_role); $function$;

REVOKE ALL ON FUNCTION private.admin_set_role(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_set_role(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_review_verification_with_note(
  p_request_id uuid, p_status text, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user_id uuid; v_account_type text; v_status public.verification_status;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Choose Approved or Rejected'; END IF;
  v_status := p_status::public.verification_status;
  SELECT user_id INTO v_user_id FROM public.verification_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request was not found'; END IF;
  UPDATE public.verification_requests SET status=v_status,reviewer_id=(SELECT auth.uid()),
    reviewer_note=NULLIF(btrim(coalesce(p_note,'')),''),reviewed_at=now() WHERE id=p_request_id;
  SELECT account_type::text INTO v_account_type FROM public.profiles WHERE id=v_user_id;
  IF v_account_type='investor' THEN
    UPDATE public.investors SET verification_status=v_status,updated_at=now() WHERE id=v_user_id;
  ELSE
    UPDATE public.businesses SET verification_status=v_status,updated_at=now() WHERE owner_id=v_user_id;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  VALUES((SELECT auth.uid()),'verification_'||p_status,'verification_request',p_request_id,
    jsonb_build_object('note',p_note,'member_id',v_user_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_verification_with_note(
  p_request_id uuid, p_status text, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.admin_review_verification_with_note(p_request_id,p_status,p_note); $function$;

REVOKE ALL ON FUNCTION private.admin_review_verification_with_note(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_review_verification_with_note(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_verification_with_note(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_verification_with_note(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_review_plan_request_with_note(
  p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_request public.subscription_requests; v_price numeric; v_now timestamptz:=now();
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO v_request FROM public.subscription_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan request was not found'; END IF;
  IF v_request.status<>'pending' THEN RAISE EXCEPTION 'This plan request has already been reviewed'; END IF;
  IF p_approve THEN
    SELECT price_inr INTO v_price FROM public.subscription_plans WHERE id=v_request.plan_id;
    IF v_price IS NULL THEN RAISE EXCEPTION 'The requested subscription plan no longer exists'; END IF;
    INSERT INTO public.subscriptions(user_id,plan_id,status,starts_at,ends_at,updated_at)
    VALUES(v_request.user_id,v_request.plan_id,'active',v_now,
      CASE WHEN v_price>0 THEN v_now+interval '30 days' ELSE NULL END,v_now)
    ON CONFLICT(user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',
      starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,updated_at=v_now;
    UPDATE public.subscription_requests SET status='approved',reviewed_at=v_now,
      reviewed_by=(SELECT auth.uid()),note=NULLIF(btrim(coalesce(p_note,'')),'')
    WHERE id=p_request_id;
  ELSE
    UPDATE public.subscription_requests SET status='rejected',reviewed_at=v_now,
      reviewed_by=(SELECT auth.uid()),note=NULLIF(btrim(coalesce(p_note,'')),'')
    WHERE id=p_request_id;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  VALUES((SELECT auth.uid()),CASE WHEN p_approve THEN 'plan_request_approved' ELSE 'plan_request_rejected' END,
    'subscription_request',p_request_id,jsonb_build_object('note',p_note));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_plan_request_with_note(
  p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.admin_review_plan_request_with_note(p_request_id,p_approve,p_note); $function$;

REVOKE ALL ON FUNCTION private.admin_review_plan_request_with_note(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_review_plan_request_with_note(uuid,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_plan_request_with_note(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_plan_request_with_note(uuid,boolean,text) TO authenticated;
