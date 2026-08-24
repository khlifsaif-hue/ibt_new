-- SmartCare V5.6 - Gap #3 Finance permissions & segregation of duties
begin;

create table if not exists public.finance_user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  can_view_all_finance boolean not null default false,
  can_budget_request boolean not null default false,
  can_budget_review boolean not null default false,
  can_budget_final_approve boolean not null default false,
  can_payment_request boolean not null default false,
  can_payment_review boolean not null default false,
  can_payment_final_approve boolean not null default false,
  can_payment_mark_paid boolean not null default false,
  can_invoice_request boolean not null default false,
  can_invoice_review boolean not null default false,
  can_invoice_issue boolean not null default false,
  can_invoice_mark_sent boolean not null default false,
  can_invoice_mark_received boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.finance_user_permissions enable row level security;

drop policy if exists finance_permissions_self_read on public.finance_user_permissions;
create policy finance_permissions_self_read
on public.finance_user_permissions for select to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_platform_admin()
);

drop policy if exists finance_permissions_admin_manage on public.finance_user_permissions;
create policy finance_permissions_admin_manage
on public.finance_user_permissions for all to authenticated
using (app_private.is_platform_admin())
with check (app_private.is_platform_admin());

-- Seed safe defaults from current roles. Admin can override per user later.
insert into public.finance_user_permissions (
  user_id,
  can_view_all_finance,
  can_budget_request,
  can_budget_review,
  can_budget_final_approve,
  can_payment_request,
  can_payment_review,
  can_payment_final_approve,
  can_payment_mark_paid,
  can_invoice_request,
  can_invoice_review,
  can_invoice_issue,
  can_invoice_mark_sent,
  can_invoice_mark_received
)
select
  p.id,
  r.name in ('ADMIN','CEO','FINANCE'),
  r.name in ('ADMIN','CEO','FINANCE','PROJECT_MANAGER','MANAGER','STAFF','TECHNICIAN'),
  r.name in ('ADMIN','FINANCE'),
  r.name in ('ADMIN','CEO'),
  r.name in ('ADMIN','CEO','FINANCE','PROJECT_MANAGER','MANAGER','STAFF','TECHNICIAN'),
  r.name in ('ADMIN','FINANCE'),
  r.name in ('ADMIN','CEO'),
  r.name in ('ADMIN','FINANCE'),
  r.name in ('ADMIN','PROJECT_MANAGER'),
  r.name in ('ADMIN','FINANCE'),
  r.name in ('ADMIN','FINANCE'),
  r.name in ('ADMIN','FINANCE'),
  r.name in ('ADMIN','FINANCE')
from public.profiles p
join public.roles r on r.id = p.role_id
on conflict (user_id) do nothing;

commit;
