CREATE OR REPLACE FUNCTION public.admin_review_verification_request(p_request_id uuid,p_status text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.admin_review_verification_request(p_request_id,p_status); $function$;

CREATE OR REPLACE FUNCTION public.admin_review_subscription_request(p_request_id uuid,p_approve boolean)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.admin_review_subscription_request(p_request_id,p_approve); $function$;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_review_verification_request(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_review_subscription_request(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_verification_request(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_subscription_request(uuid,boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_review_verification_request(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_subscription_request(uuid,boolean) FROM PUBLIC, anon;
