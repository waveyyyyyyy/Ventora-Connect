-- Allow participants to see the participant list of their own conversations only.
drop policy if exists conversation_members_read on public.conversation_members;
create policy conversation_members_read on public.conversation_members for select
using(user_id=auth.uid()
  or exists(select 1 from public.conversation_members mine
    where mine.conversation_id=conversation_members.conversation_id and mine.user_id=auth.uid())
  or public.is_admin());
