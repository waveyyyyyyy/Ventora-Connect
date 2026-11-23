revoke update on table public.feedback_items from authenticated;
grant update (status, updated_at) on table public.feedback_items to authenticated;