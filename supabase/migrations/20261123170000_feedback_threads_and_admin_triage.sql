create table if not exists public.feedback_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 category text not null check (category in ('Suggestion','Bug Report','Feature Idea','Design & UX','Membership & Plans','Other')),
 title text not null check (char_length(btrim(title)) between 4 and 140),
 description text not null check (char_length(btrim(description)) between 10 and 10000),
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 page_context text check (page_context is null or char_length(page_context) <= 180),
 status text not null default 'open' check (status in ('open','in_review','planned','resolved','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.feedback_replies (
 id uuid primary key default gen_random_uuid(),
 feedback_id uuid not null references public.feedback_items(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 author_role text not null default 'member' check (author_role in ('member','admin')),
 body text not null check (char_length(btrim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index if not exists feedback_items_user_created_idx on public.feedback_items(user_id, created_at desc);
create index if not exists feedback_items_status_created_idx on public.feedback_items(status, created_at desc);
create index if not exists feedback_replies_thread_created_idx on public.feedback_replies(feedback_id, created_at asc);
alter table public.feedback_items enable row level security;
alter table public.feedback_replies enable row level security;
revoke all on public.feedback_items from anon, authenticated;
revoke all on public.feedback_replies from anon, authenticated;
grant select, insert, update on public.feedback_items to authenticated;
grant select, insert on public.feedback_replies to authenticated;
drop policy if exists feedback_items_read_own_or_admin on public.feedback_items;
create policy feedback_items_read_own_or_admin on public.feedback_items for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists feedback_items_submit_own on public.feedback_items;
create policy feedback_items_submit_own on public.feedback_items for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_active_member()));
drop policy if exists feedback_items_admin_update on public.feedback_items;
create policy feedback_items_admin_update on public.feedback_items for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists feedback_replies_read_thread on public.feedback_replies;
create policy feedback_replies_read_thread on public.feedback_replies for select to authenticated using (
 (select public.is_admin()) or exists (
  select 1 from public.feedback_items f
  where f.id = feedback_replies.feedback_id and f.user_id = (select auth.uid())
 )
);
drop policy if exists feedback_replies_post_thread on public.feedback_replies;
create policy feedback_replies_post_thread on public.feedback_replies for insert to authenticated with check (
 author_id = (select auth.uid()) and (
  (author_role = 'admin' and (select public.is_admin())) or
  (author_role = 'member' and (select public.is_active_member()) and exists (
   select 1 from public.feedback_items f
   where f.id = feedback_replies.feedback_id and f.user_id = (select auth.uid())
  ))
 )
);
comment on table public.feedback_items is 'Private member feedback threads visible to their owner and authorized Ventora administrators.';
comment on table public.feedback_replies is 'Two-way member and administrator replies for private feedback threads.';
