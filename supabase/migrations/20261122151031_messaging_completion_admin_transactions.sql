CREATE OR REPLACE FUNCTION private.start_conversation(target_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user_id uuid := (SELECT auth.uid()); v_account_type text; new_conversation uuid; existing_conversation uuid;
BEGIN
 IF v_user_id IS NULL OR target_user IS NULL OR target_user=v_user_id THEN RAISE EXCEPTION 'Invalid conversation participants'; END IF;
 IF NOT private.is_active_member() THEN RAISE EXCEPTION 'Your account is not active for private messaging'; END IF;
 SELECT p.account_type::text INTO v_account_type FROM public.profiles p WHERE p.id=v_user_id AND p.account_type_selected IS TRUE AND p.is_suspended IS FALSE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Complete account setup before starting a conversation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=target_user AND p.account_type_selected IS TRUE AND p.is_suspended IS FALSE) THEN RAISE EXCEPTION 'This Ventora member is not available for private messaging'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_user_id AND nullif(btrim(coalesce(p.full_name,'')),'') IS NOT NULL AND nullif(btrim(coalesce(p.bio,'')),'') IS NOT NULL AND nullif(btrim(coalesce(p.city,'')),'') IS NOT NULL AND nullif(btrim(coalesce(p.country,'')),'') IS NOT NULL) THEN RAISE EXCEPTION 'Complete your name, introduction, city and country before messaging'; END IF;
 IF v_account_type='business' AND NOT EXISTS(SELECT 1 FROM public.businesses b WHERE b.owner_id=v_user_id AND nullif(btrim(coalesce(b.company_name,'')),'') IS NOT NULL AND nullif(btrim(coalesce(b.industry,'')),'') IS NOT NULL AND nullif(btrim(coalesce(b.description,'')),'') IS NOT NULL) THEN RAISE EXCEPTION 'Complete your business name, industry and company overview before messaging';
 ELSIF v_account_type='investor' AND NOT EXISTS(SELECT 1 FROM public.investors i WHERE i.id=v_user_id AND (i.investment_min IS NOT NULL OR i.investment_max IS NOT NULL) AND coalesce(cardinality(i.preferred_industries),0)>0 AND coalesce(cardinality(i.preferred_stages),0)>0) THEN RAISE EXCEPTION 'Complete your investment range, preferred industries and preferred stages before messaging';
 ELSIF v_account_type NOT IN('business','investor') THEN RAISE EXCEPTION 'Choose a Business or Investor account before messaging'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=v_user_id AND b.blocked_id=target_user) OR (b.blocker_id=target_user AND b.blocked_id=v_user_id)) THEN RAISE EXCEPTION 'Messaging is unavailable for this member'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(LEAST(v_user_id::text,target_user::text)||':'||GREATEST(v_user_id::text,target_user::text),0));
 SELECT cm.conversation_id INTO existing_conversation FROM public.conversation_members cm WHERE cm.user_id=v_user_id AND EXISTS(SELECT 1 FROM public.conversation_members other WHERE other.conversation_id=cm.conversation_id AND other.user_id=target_user) LIMIT 1;
 IF existing_conversation IS NOT NULL THEN RETURN existing_conversation; END IF;
 INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conversation;
 INSERT INTO public.conversation_members(conversation_id,user_id) VALUES(new_conversation,v_user_id),(new_conversation,target_user);
 RETURN new_conversation;
END;
$function$;

CREATE OR REPLACE FUNCTION private.admin_review_verification_request(p_request_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user_id uuid; v_account_type text; v_status public.verification_status;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF p_status IS NULL OR p_status NOT IN('approved','rejected') THEN RAISE EXCEPTION 'Choose Approved or Rejected'; END IF;
 v_status:=p_status::public.verification_status;
 SELECT vr.user_id INTO v_user_id FROM public.verification_requests vr WHERE vr.id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verification request was not found'; END IF;
 UPDATE public.verification_requests SET status=v_status,reviewer_id=(SELECT auth.uid()),reviewed_at=now() WHERE id=p_request_id;
 SELECT p.account_type::text INTO v_account_type FROM public.profiles p WHERE p.id=v_user_id;
 IF v_account_type='investor' THEN UPDATE public.investors SET verification_status=v_status,updated_at=now() WHERE id=v_user_id;
 ELSE UPDATE public.businesses SET verification_status=v_status,updated_at=now() WHERE owner_id=v_user_id; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION private.admin_review_subscription_request(p_request_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_request public.subscription_requests; v_price numeric; v_now timestamptz:=now();
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT sr.* INTO v_request FROM public.subscription_requests sr WHERE sr.id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan request was not found'; END IF;
 IF v_request.status<>'pending' THEN RAISE EXCEPTION 'This plan request has already been reviewed'; END IF;
 IF p_approve THEN
  SELECT sp.price_inr INTO v_price FROM public.subscription_plans sp WHERE sp.id=v_request.plan_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'The requested subscription plan no longer exists'; END IF;
  INSERT INTO public.subscriptions(user_id,plan_id,status,starts_at,ends_at,updated_at)
  VALUES(v_request.user_id,v_request.plan_id,'active',v_now,CASE WHEN v_price>0 THEN v_now+interval '30 days' ELSE NULL END,v_now)
  ON CONFLICT(user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,updated_at=EXCLUDED.updated_at;
  UPDATE public.subscription_requests SET status='approved',reviewed_at=v_now,reviewed_by=(SELECT auth.uid()) WHERE id=p_request_id;
 ELSE
  UPDATE public.subscription_requests SET status='rejected',reviewed_at=v_now,reviewed_by=(SELECT auth.uid()) WHERE id=p_request_id;
 END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_verification_request(p_request_id uuid,p_status text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT private.admin_review_verification_request(p_request_id,p_status); $function$;
CREATE OR REPLACE FUNCTION public.admin_review_subscription_request(p_request_id uuid,p_approve boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT private.admin_review_subscription_request(p_request_id,p_approve); $function$;
REVOKE ALL ON FUNCTION private.admin_review_verification_request(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.admin_review_subscription_request(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_review_verification_request(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_review_subscription_request(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_verification_request(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_subscription_request(uuid,boolean) TO authenticated,service_role;
