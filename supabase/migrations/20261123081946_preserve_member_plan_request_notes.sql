ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS review_note text;
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
      reviewed_by=(SELECT auth.uid()),review_note=NULLIF(btrim(coalesce(p_note,'')),'')
    WHERE id=p_request_id;
  ELSE
    UPDATE public.subscription_requests SET status='rejected',reviewed_at=v_now,
      reviewed_by=(SELECT auth.uid()),review_note=NULLIF(btrim(coalesce(p_note,'')),'')
    WHERE id=p_request_id;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  VALUES((SELECT auth.uid()),CASE WHEN p_approve THEN 'plan_request_approved' ELSE 'plan_request_rejected' END,
    'subscription_request',p_request_id,jsonb_build_object('review_note',p_note));
END;
$function$;
