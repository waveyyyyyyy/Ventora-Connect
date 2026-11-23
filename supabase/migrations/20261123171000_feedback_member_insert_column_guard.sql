revoke insert on table public.feedback_items from authenticated;
grant insert (user_id, category, title, description, priority, page_context) on public.feedback_items to authenticated;
drop policy if exists feedback_items_submit_own on public.feedback_items;
create policy feedback_items_submit_own on public.feedback_items for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'open' and (select public.is_active_member()));