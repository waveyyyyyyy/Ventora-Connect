CREATE OR REPLACE FUNCTION private.admin_set_role(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_admin_count integer;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN ('admin','none') THEN
    RAISE EXCEPTION 'Choose a valid member and role';
  END IF;
  IF p_role='none' THEN
    IF p_user_id=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot remove your own administrator access'; END IF;
    SELECT count(*) INTO v_admin_count FROM public.admin_roles WHERE role='admin';
    IF EXISTS(SELECT 1 FROM public.admin_roles WHERE user_id=p_user_id AND role='admin') AND v_admin_count<=1 THEN
      RAISE EXCEPTION 'The last administrator cannot be removed';
    END IF;
    DELETE FROM public.admin_roles WHERE user_id=p_user_id;
  ELSE
    INSERT INTO public.admin_roles(user_id,role) VALUES(p_user_id,'admin')
    ON CONFLICT(user_id) DO UPDATE SET role='admin';
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  VALUES((SELECT auth.uid()),'admin_role_changed','member',p_user_id,jsonb_build_object('role',p_role));
END;
$function$;
