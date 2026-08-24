-- SmartCare V5.5 - Gap #2 Universal Approval Engine
-- Reusable approval workflow for finance and future SmartCare request types.
begin;

create table if not exists public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('BUDGET_REQUEST','PAYMENT_REQUEST','CUSTOMER_INVOICE_REQUEST','PURCHASE_REQUEST','OTHER')),
  entity_id text not null,
  project_id uuid references public.projects(id) on delete set null,
  workflow_key text not null,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','MODIFICATION_REQUIRED','APPROVED','REJECTED','CANCELLED')),
  current_step_order integer,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, entity_id)
);
create index if not exists approval_workflows_status_idx on public.approval_workflows(status, created_at desc);
create index if not exists approval_workflows_project_idx on public.approval_workflows(project_id, status, created_at desc);
create index if not exists approval_workflows_submitter_idx on public.approval_workflows(submitted_by, created_at desc);

create table if not exists public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_key text not null,
  title text not null,
  approver_role text not null check (approver_role in ('FINANCE','CEO','ADMIN','PROJECT_MANAGER','MANAGER')),
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','APPROVED','REJECTED','MODIFICATION_REQUIRED','SKIPPED')),
  decided_by uuid references public.profiles(id) on delete set null,
  decision_comment text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workflow_id, step_order),
  unique(workflow_id, step_key)
);
create index if not exists approval_steps_active_role_idx on public.approval_steps(approver_role, status, created_at desc);
create index if not exists approval_steps_workflow_idx on public.approval_steps(workflow_id, step_order);

-- Append-only evidence of every workflow transition.
create table if not exists public.approval_events (
  id bigint generated always as identity primary key,
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  step_id uuid references public.approval_steps(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('SUBMIT','APPROVE','REJECT','REQUEST_MODIFICATION','RESUBMIT','CANCEL')),
  from_status text,
  to_status text not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists approval_events_workflow_idx on public.approval_events(workflow_id, created_at);
create index if not exists approval_events_actor_idx on public.approval_events(actor_id, created_at desc);

-- Keep updated_at deterministic without requiring application code.
create or replace function public.set_smartcare_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists approval_workflows_updated_at on public.approval_workflows;
create trigger approval_workflows_updated_at before update on public.approval_workflows
for each row execute function public.set_smartcare_updated_at();

drop trigger if exists approval_steps_updated_at on public.approval_steps;
create trigger approval_steps_updated_at before update on public.approval_steps
for each row execute function public.set_smartcare_updated_at();

-- Approval history is immutable. It may be inserted but never edited/deleted by clients.
alter table public.approval_workflows enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_events enable row level security;

-- Visibility: submitter, project users, Finance, CEO and Admin.
drop policy if exists approval_workflows_select on public.approval_workflows;
create policy approval_workflows_select on public.approval_workflows for select to authenticated using (
  submitted_by = (select auth.uid())
  or app_private.current_role() in ('FINANCE','CEO','ADMIN')
  or (project_id is not null and app_private.can_project(project_id,'view'))
);

drop policy if exists approval_workflows_insert on public.approval_workflows;
create policy approval_workflows_insert on public.approval_workflows for insert to authenticated with check (
  submitted_by = (select auth.uid())
  and (project_id is null or app_private.can_project(project_id,'create') or app_private.is_platform_admin())
);

drop policy if exists approval_workflows_update on public.approval_workflows;
create policy approval_workflows_update on public.approval_workflows for update to authenticated using (
  submitted_by = (select auth.uid())
  or app_private.current_role() in ('FINANCE','CEO','ADMIN')
) with check (
  submitted_by = (select auth.uid())
  or app_private.current_role() in ('FINANCE','CEO','ADMIN')
);

drop policy if exists approval_steps_select on public.approval_steps;
create policy approval_steps_select on public.approval_steps for select to authenticated using (
  exists (select 1 from public.approval_workflows w where w.id=workflow_id and (
    w.submitted_by=(select auth.uid()) or app_private.current_role() in ('FINANCE','CEO','ADMIN')
    or (w.project_id is not null and app_private.can_project(w.project_id,'view'))
  ))
);

drop policy if exists approval_steps_insert on public.approval_steps;
create policy approval_steps_insert on public.approval_steps for insert to authenticated with check (
  exists (select 1 from public.approval_workflows w where w.id=workflow_id and w.submitted_by=(select auth.uid()))
  or app_private.current_role() in ('ADMIN')
);

drop policy if exists approval_steps_update on public.approval_steps;
create policy approval_steps_update on public.approval_steps for update to authenticated using (
  app_private.current_role() = approver_role or app_private.current_role()='ADMIN'
  or exists (select 1 from public.approval_workflows w where w.id=workflow_id and w.submitted_by=(select auth.uid()) and w.status='MODIFICATION_REQUIRED')
) with check (true);

drop policy if exists approval_events_select on public.approval_events;
create policy approval_events_select on public.approval_events for select to authenticated using (
  exists (select 1 from public.approval_workflows w where w.id=workflow_id and (
    w.submitted_by=(select auth.uid()) or app_private.current_role() in ('FINANCE','CEO','ADMIN')
    or (w.project_id is not null and app_private.can_project(w.project_id,'view'))
  ))
);

drop policy if exists approval_events_insert on public.approval_events;
create policy approval_events_insert on public.approval_events for insert to authenticated with check (actor_id=(select auth.uid()));

-- No update/delete policies on approval_events: history is append-only.
commit;
