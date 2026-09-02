-- One Admin or Finance decision approves a Purchase Request.
-- The generated Purchase Order is then completed and issued by Admin.
begin;

-- Finance is a global recipient/approver for this workflow even when it has not
-- been added as a member of the request's project.
drop policy if exists projects_read on public.projects;
create policy projects_read
on public.projects for select to authenticated
using (
  app_private.current_role()='FINANCE'
  or app_private.can_project(id,'view')
);

drop policy if exists purchase_requests_read on public.purchase_requests;
create policy purchase_requests_read
on public.purchase_requests for select to authenticated
using (
  requester_user_id=(select auth.uid())
  or app_private.current_role()='FINANCE'
  or app_private.can_project(project_id,'view')
);

drop policy if exists purchase_requests_update on public.purchase_requests;
create policy purchase_requests_update
on public.purchase_requests for update to authenticated
using (
  app_private.current_role()='FINANCE'
  or app_private.can_project(project_id,'approve')
)
with check (
  app_private.current_role()='FINANCE'
  or app_private.can_project(project_id,'approve')
);

alter table public.purchase_request_approvals
  drop constraint if exists purchase_request_approvals_approver_role_check;

alter table public.purchase_request_approvals
  add constraint purchase_request_approvals_approver_role_check
  check (approver_role in ('PROJECT_MANAGER','CEO','FINANCE','ADMIN'));

drop policy if exists purchase_request_approvals_create on public.purchase_request_approvals;
create policy purchase_request_approvals_create
on public.purchase_request_approvals for insert to authenticated
with check (
  approver_id=(select auth.uid())
  and approver_role=app_private.current_role()
  and app_private.current_role() in ('FINANCE','ADMIN')
  and exists (select 1 from public.purchase_requests pr where pr.id=purchase_request_id)
);

drop policy if exists order_progress_read on public.order_progress;
create policy order_progress_read
on public.order_progress for select to authenticated
using (
  app_private.current_role()='FINANCE'
  or app_private.can_project(project_id,'view')
  or requested_by=(select auth.uid())
  or responsible_user_id=(select auth.uid())
);

drop policy if exists order_progress_write on public.order_progress;
create policy order_progress_write
on public.order_progress for all to authenticated
using (
  app_private.current_role()='FINANCE'
  or app_private.can_project(project_id,'edit')
  or requested_by=(select auth.uid())
  or responsible_user_id=(select auth.uid())
)
with check (
  app_private.current_role()='FINANCE'
  or app_private.can_project(project_id,'edit')
  or requested_by=(select auth.uid())
  or responsible_user_id=(select auth.uid())
);

drop policy if exists order_progress_updates_read on public.order_progress_updates;
create policy order_progress_updates_read
on public.order_progress_updates for select to authenticated
using (
  app_private.current_role()='FINANCE'
  or exists (
    select 1 from public.order_progress p
    where p.id=order_progress_id
      and (
        app_private.can_project(p.project_id,'view')
        or p.requested_by=(select auth.uid())
        or p.responsible_user_id=(select auth.uid())
      )
  )
);

drop policy if exists order_progress_updates_write on public.order_progress_updates;
create policy order_progress_updates_write
on public.order_progress_updates for insert to authenticated
with check (
  app_private.current_role()='FINANCE'
  or exists (
    select 1 from public.order_progress p
    where p.id=order_progress_id
      and (
        app_private.can_project(p.project_id,'edit')
        or p.requested_by=(select auth.uid())
        or p.responsible_user_id=(select auth.uid())
      )
  )
);

commit;
