-- SmartCare V5.7: project hierarchy + Gap #4 budget accounting
begin;

alter table public.projects
  add column if not exists parent_project_id uuid references public.projects(id) on delete restrict,
  add column if not exists project_code text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_note text not null default '';

create index if not exists projects_parent_idx on public.projects(parent_project_id,status,name);
create unique index if not exists projects_code_unique on public.projects(lower(project_code))
where nullif(trim(project_code),'') is not null;

alter table public.projects drop constraint if exists projects_not_own_parent;
alter table public.projects add constraint projects_not_own_parent
check(parent_project_id is null or parent_project_id<>id);

create or replace function public.prevent_project_hierarchy_cycle()
returns trigger language plpgsql as $$
declare cursor_id uuid;
begin
  if new.parent_project_id is null then return new; end if;
  if new.parent_project_id=new.id then raise exception 'A project cannot be its own parent'; end if;
  cursor_id:=new.parent_project_id;
  while cursor_id is not null loop
    if cursor_id=new.id then raise exception 'Project hierarchy cycle detected'; end if;
    select parent_project_id into cursor_id from public.projects where id=cursor_id;
  end loop;
  return new;
end $$;

drop trigger if exists projects_prevent_hierarchy_cycle on public.projects;
create trigger projects_prevent_hierarchy_cycle
before insert or update of parent_project_id on public.projects
for each row execute function public.prevent_project_hierarchy_cycle();

create or replace view public.project_financial_rollup
with (security_invoker=true) as
with recursive tree as (
  select p.id ancestor_id,p.id descendant_id from public.projects p
  union all
  select t.ancestor_id,c.id from tree t join public.projects c on c.parent_project_id=t.descendant_id
),
direct_finance as (
  select p.id project_id,
         coalesce(f.approved_budget,0)::numeric approved_budget,
         coalesce(f.committed,0)::numeric committed,
         coalesce(f.spent,0)::numeric spent
  from public.projects p left join public.project_financials f on f.project_id=p.id
),
rollup as (
  select t.ancestor_id project_id,
         sum(df.committed)::numeric committed,
         sum(df.spent)::numeric spent
  from tree t join direct_finance df on df.project_id=t.descendant_id
  group by t.ancestor_id
),
children as (
  select p.parent_project_id project_id,count(*)::integer child_count,
         coalesce(sum(f.approved_budget),0)::numeric allocated_to_children
  from public.projects p left join public.project_financials f on f.project_id=p.id
  where p.parent_project_id is not null group by p.parent_project_id
)
select p.id project_id,p.parent_project_id,
       df.approved_budget,
       df.committed direct_committed,df.spent direct_spent,
       coalesce(r.committed,0)::numeric committed,
       coalesce(r.spent,0)::numeric spent,
       coalesce(c.child_count,0)::integer child_count,
       coalesce(c.allocated_to_children,0)::numeric allocated_to_children,
       greatest(df.approved_budget-coalesce(r.committed,0)-coalesce(r.spent,0),0)::numeric available_budget,
       greatest(df.approved_budget-coalesce(c.allocated_to_children,0),0)::numeric unallocated_budget
from public.projects p
join direct_finance df on df.project_id=p.id
left join rollup r on r.project_id=p.id
left join children c on c.project_id=p.id;

grant select on public.project_financial_rollup to authenticated;

create index if not exists payment_requests_project_finance_idx
on public.payment_requests(project_id,current_status,purchase_order_id);

insert into public.app_modules(module_key,title,path,enabled,sort_order)
values('sub_projects','Sub-projects','/sub-projects',true,11)
on conflict(module_key) do update set title=excluded.title,path=excluded.path,enabled=true;

insert into public.user_permissions(user_id,module_key,can_view,can_create,can_edit,can_delete,can_approve)
select p.id,'sub_projects',true,
       upper(r.name) in ('CEO','ADMIN','PROJECT_MANAGER','MANAGER','FINANCE'),
       upper(r.name) in ('CEO','ADMIN','PROJECT_MANAGER','MANAGER','FINANCE'),
       upper(r.name) in ('CEO','ADMIN'),
       upper(r.name) in ('CEO','ADMIN','PROJECT_MANAGER','FINANCE')
from public.profiles p join public.roles r on r.id=p.role_id
on conflict(user_id,module_key) do nothing;

insert into public.app_modules(module_key,title,path,enabled,sort_order)
values('finance_payments','Payment Requests','/finance/payments',true,22)
on conflict(module_key) do update set title=excluded.title,path=excluded.path,enabled=true;

insert into public.user_permissions(user_id,module_key,can_view,can_create,can_edit,can_delete,can_approve)
select p.id,'finance_payments',
       upper(r.name) in ('CEO','ADMIN','FINANCE','PROJECT_MANAGER','MANAGER','STAFF'),
       upper(r.name) in ('CEO','ADMIN','FINANCE','PROJECT_MANAGER','MANAGER','STAFF'),
       upper(r.name) in ('CEO','ADMIN','FINANCE'),
       upper(r.name) in ('CEO','ADMIN'),
       upper(r.name) in ('CEO','ADMIN','FINANCE')
from public.profiles p join public.roles r on r.id=p.role_id
on conflict(user_id,module_key) do nothing;

commit;
