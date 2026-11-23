-- Persist an in-app notification whenever an administrator approves or rejects a subscription request.
CREATE OR REPLACE FUNCTION private.admin_review_plan_request_with_note(
  p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_request public.subscription_requests; v_price numeric; v_plan_name text; v_now timestamptz:=now();
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO v_request FROM public.subscription_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan request was not found'; END IF;
  IF v_request.status<>'pending' THEN RAISE EXCEPTION 'This plan request has already been reviewed'; END IF;
  SELECT price_inr,name INTO v_price,v_plan_name FROM public.subscription_plans WHERE id=v_request.plan_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'The requested subscription plan no longer exists'; END IF;
  IF p_approve THEN
    INSERT INTO public.subscriptions(user_id,plan_id,status,starts_at,ends_at,updated_at)
    VALUES(v_request.user_id,v_request.plan_id,'active',v_now,
      CASE WHEN v_price>0 THEN v_now+interval '30 days' ELSE NULL END,v_now)
    ON CONFLICT(user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',
      starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,updated_at=v_now;
    UPDATE public.subscription_requests SET status='approved',reviewed_at=v_now,
      reviewed_by=(SELECT auth.uid()),note=NULLIF(btrim(coalesce(p_note,'')),'')
    WHERE id=p_request_id;
    INSERT INTO public.notifications(user_id,type,title,body,payload)
    VALUES(v_request.user_id,'subscription_activated','Your subscription is now active',
      'Your '||coalesce(v_plan_name,'selected')||' subscription has been approved and is now active.',
      jsonb_build_object('plan_id',v_request.plan_id,'request_id',p_request_id,'status','active'));
  ELSE
    UPDATE public.subscription_requests SET status='rejected',reviewed_at=v_now,
      reviewed_by=(SELECT auth.uid()),note=NULLIF(btrim(coalesce(p_note,'')),'')
    WHERE id=p_request_id;
    INSERT INTO public.notifications(user_id,type,title,body,payload)
    VALUES(v_request.user_id,'subscription_rejected','Subscription request not approved',
      'Your request for '||coalesce(v_plan_name,'the selected')||' was not approved. Open Subscriptions to review the request details.',
      jsonb_build_object('plan_id',v_request.plan_id,'request_id',p_request_id,'status','rejected'));
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
