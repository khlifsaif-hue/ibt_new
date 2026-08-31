-- Allow a goal (task, activity, KPI or milestone) to involve multiple users.
create table if not exists public.trackable_item_users (
  trackable_item_id uuid not null references public.trackable_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trackable_item_id, user_id)
);

create index if not exists trackable_item_users_user_idx
  on public.trackable_item_users(user_id, trackable_item_id);
create index if not exists trackable_item_users_project_idx
  on public.trackable_item_users(project_id, trackable_item_id);

alter table public.trackable_item_users enable row level security;

drop policy if exists trackable_item_users_read on public.trackable_item_users;
create policy trackable_item_users_read on public.trackable_item_users
for select to authenticated using (
  user_id = (select auth.uid())
  or app_private.can_project(project_id, 'view')
);

drop policy if exists trackable_item_users_create on public.trackable_item_users;
create policy trackable_item_users_create on public.trackable_item_users
for insert to authenticated with check (
  assigned_by = (select auth.uid())
  and app_private.can_project(project_id, 'create')
);

drop policy if exists trackable_item_users_update on public.trackable_item_users;
create policy trackable_item_users_update on public.trackable_item_users
for update to authenticated using (
  app_private.can_project(project_id, 'edit')
) with check (
  app_private.can_project(project_id, 'edit')
);

drop policy if exists trackable_item_users_delete on public.trackable_item_users;
create policy trackable_item_users_delete on public.trackable_item_users
for delete to authenticated using (
  app_private.can_project(project_id, 'edit')
);

grant select, insert, update, delete on public.trackable_item_users to authenticated;

-- Preserve all existing individual and group assignments as involved people.
insert into public.trackable_item_users (trackable_item_id, project_id, user_id, assigned_by)
select id, project_id, owner_user_id, created_by
from public.trackable_items
where owner_user_id is not null
on conflict (trackable_item_id, user_id) do nothing;

insert into public.trackable_item_users (trackable_item_id, project_id, user_id, assigned_by)
select t.id, t.project_id, gm.user_id, t.created_by
from public.trackable_items t
join public.group_members gm on gm.group_id = t.owner_group_id
where t.owner_group_id is not null
on conflict (trackable_item_id, user_id) do nothing;

drop policy if exists trackables_read on public.trackable_items;
create policy trackables_read on public.trackable_items for select to authenticated using (
  app_private.can_project(project_id,'view')
  or owner_user_id=(select auth.uid())
  or reviewer_id=(select auth.uid())
  or exists(select 1 from public.group_members gm where gm.group_id=owner_group_id and gm.user_id=(select auth.uid()))
  or exists(select 1 from public.trackable_item_users tiu where tiu.trackable_item_id=trackable_items.id and tiu.user_id=(select auth.uid()))
);

drop policy if exists trackables_update on public.trackable_items;
create policy trackables_update on public.trackable_items for update to authenticated using (
  app_private.can_project(project_id,'edit')
  or owner_user_id=(select auth.uid())
  or reviewer_id=(select auth.uid())
  or exists(select 1 from public.group_members gm where gm.group_id=owner_group_id and gm.user_id=(select auth.uid()))
  or exists(select 1 from public.trackable_item_users tiu where tiu.trackable_item_id=trackable_items.id and tiu.user_id=(select auth.uid()))
) with check (
  app_private.can_project(project_id,'view')
  or owner_user_id=(select auth.uid())
  or reviewer_id=(select auth.uid())
  or exists(select 1 from public.group_members gm where gm.group_id=owner_group_id and gm.user_id=(select auth.uid()))
  or exists(select 1 from public.trackable_item_users tiu where tiu.trackable_item_id=trackable_items.id and tiu.user_id=(select auth.uid()))
);

-- Ask PostgREST to immediately discover the new table and foreign keys.
notify pgrst, 'reload schema';
