-- SmartCare V5.4 - Gap #1 Finance foundation data model
-- Purpose: establish normalized project-finance entities before approval/workflow UI is built.
-- This migration is additive. It does not replace the existing project_financials,
-- purchase_requests, purchase_orders, or project_expenses lifecycle.

begin;

-- -----------------------------------------------------------------------------
-- Funding sources (client contract, internal funding, grant, etc.)
-- -----------------------------------------------------------------------------
create table if not exists public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null default 'CLIENT' check (source_type in ('CLIENT','INTERNAL','GRANT','OTHER')),
  customer_name text,
  contract_reference text,
  currency text not null default 'QAR' check (char_length(currency) = 3),
  contract_value numeric(16,2) check (contract_value is null or contract_value >= 0),
  start_date date,
  end_date date,
  active boolean not null default true,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_sources_date_order check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists funding_sources_type_active_idx on public.funding_sources(source_type, active);
create index if not exists funding_sources_customer_idx on public.funding_sources(customer_name) where customer_name is not null;
create unique index if not exists funding_sources_contract_reference_unique
  on public.funding_sources(lower(contract_reference)) where nullif(trim(contract_reference),'') is not null;

-- A project may have more than one source; one can be marked primary.
create table if not exists public.project_funding_sources (
  project_id uuid not null references public.projects(id) on delete cascade,
  funding_source_id uuid not null references public.funding_sources(id) on delete restrict,
  allocated_amount numeric(16,2) check (allocated_amount is null or allocated_amount >= 0),
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(project_id, funding_source_id)
);
create index if not exists project_funding_sources_source_idx on public.project_funding_sources(funding_source_id, project_id);
create unique index if not exists project_funding_sources_one_primary_idx
  on public.project_funding_sources(project_id) where is_primary;

-- -----------------------------------------------------------------------------
-- Budget requests
-- Approval sequencing is intentionally NOT hard-coded here; Gap #2 will attach
-- the universal approval engine. current_status is the workflow-facing state.
-- -----------------------------------------------------------------------------
create table if not exists public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  project_id uuid not null references public.projects(id) on delete restrict,
  funding_source_id uuid references public.funding_sources(id) on delete set null,
  budget_branch_id bigint references public.budget_branches(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'QAR' check (char_length(currency) = 3),
  purpose text not null,
  details text not null default '',
  needed_by date,
  current_status text not null default 'DRAFT' check (
    current_status in ('DRAFT','SUBMITTED','FINANCE_REVIEW','CEO_REVIEW','MODIFICATION_REQUIRED','APPROVED','REJECTED','CANCELLED')
  ),
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists budget_requests_project_status_idx on public.budget_requests(project_id, current_status, created_at desc);
create index if not exists budget_requests_requester_idx on public.budget_requests(requested_by, created_at desc);
create index if not exists budget_requests_funding_source_idx on public.budget_requests(funding_source_id) where funding_source_id is not null;

-- -----------------------------------------------------------------------------
-- Payment requests
-- Approved-for-payment and Paid are deliberately separate states.
-- -----------------------------------------------------------------------------
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  project_id uuid not null references public.projects(id) on delete restrict,
  funding_source_id uuid references public.funding_sources(id) on delete set null,
  budget_request_id uuid references public.budget_requests(id) on delete set null,
  purchase_request_id text references public.purchase_requests(id) on delete set null,
  purchase_order_id text references public.purchase_orders(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  payee_name text not null,
  payee_reference text,
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'QAR' check (char_length(currency) = 3),
  purpose text not null,
  details text not null default '',
  due_date date,
  invoice_reference text,
  current_status text not null default 'DRAFT' check (
    current_status in ('DRAFT','SUBMITTED','FINANCE_REVIEW','CEO_REVIEW','MODIFICATION_REQUIRED','REJECTED','APPROVED_FOR_PAYMENT','PAID','CANCELLED')
  ),
  payment_reference text,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_requests_paid_shape check (
    current_status <> 'PAID' or (paid_at is not null and nullif(trim(payment_reference),'') is not null)
  )
);
create index if not exists payment_requests_project_status_idx on public.payment_requests(project_id, current_status, created_at desc);
create index if not exists payment_requests_requester_idx on public.payment_requests(requested_by, created_at desc);
create index if not exists payment_requests_due_idx on public.payment_requests(due_date, current_status) where due_date is not null;
create index if not exists payment_requests_po_idx on public.payment_requests(purchase_order_id) where purchase_order_id is not null;

-- -----------------------------------------------------------------------------
-- Customer invoice requests from project teams to Finance.
-- -----------------------------------------------------------------------------
create table if not exists public.customer_invoice_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  project_id uuid not null references public.projects(id) on delete restrict,
  funding_source_id uuid references public.funding_sources(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  customer_name text not null,
  contract_reference text,
  milestone_reference text,
  milestone_description text not null default '',
  requested_amount numeric(16,2) not null check (requested_amount > 0),
  currency text not null default 'QAR' check (char_length(currency) = 3),
  expected_invoice_date date,
  current_status text not null default 'DRAFT' check (
    current_status in ('DRAFT','SUBMITTED','FINANCE_REVIEW','MODIFICATION_REQUIRED','REJECTED','READY_TO_INVOICE','INVOICED','CANCELLED')
  ),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_invoice_requests_project_status_idx
  on public.customer_invoice_requests(project_id, current_status, created_at desc);
create index if not exists customer_invoice_requests_requester_idx
  on public.customer_invoice_requests(requested_by, created_at desc);

-- -----------------------------------------------------------------------------
-- Accounts-receivable visibility. SmartCare tracks operational invoice status;
-- it is not intended to become the general ledger/accounting system.
-- -----------------------------------------------------------------------------
create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_request_id uuid references public.customer_invoice_requests(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete restrict,
  funding_source_id uuid references public.funding_sources(id) on delete set null,
  customer_name text not null,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'QAR' check (char_length(currency) = 3),
  status text not null default 'DRAFT' check (
    status in ('DRAFT','ISSUED','SENT','OUTSTANDING','DUE_SOON','OVERDUE','PARTIALLY_PAID','PAID','CANCELLED')
  ),
  sent_at timestamptz,
  received_amount numeric(16,2) not null default 0 check (received_amount >= 0),
  received_date date,
  payment_reference text,
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_invoices_received_amount_limit check (received_amount <= amount),
  constraint customer_invoices_due_order check (due_date is null or invoice_date is null or due_date >= invoice_date),
  constraint customer_invoices_paid_shape check (status <> 'PAID' or received_amount = amount)
);
create unique index if not exists customer_invoices_invoice_number_unique
  on public.customer_invoices(lower(invoice_number)) where nullif(trim(invoice_number),'') is not null;
create index if not exists customer_invoices_project_status_idx on public.customer_invoices(project_id, status, due_date);
create index if not exists customer_invoices_due_idx on public.customer_invoices(due_date, status) where due_date is not null;
create index if not exists customer_invoices_request_idx on public.customer_invoices(invoice_request_id) where invoice_request_id is not null;

-- -----------------------------------------------------------------------------
-- Secure document metadata. Actual bytes remain in Supabase Storage.
-- entity_type/entity_id creates one document layer for all finance processes.
-- -----------------------------------------------------------------------------
create table if not exists public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('BUDGET_REQUEST','PAYMENT_REQUEST','INVOICE_REQUEST','CUSTOMER_INVOICE')),
  entity_id uuid not null,
  document_type text not null check (
    document_type in ('SUPPORTING','QUOTATION','PURCHASE_ORDER','SUPPLIER_INVOICE','CONTRACT','DELIVERY_ACCEPTANCE','CUSTOMER_INVOICE','PAYMENT_PROOF','OTHER')
  ),
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);
create index if not exists financial_documents_entity_idx on public.financial_documents(entity_type, entity_id, created_at desc);

-- Optional references from recorded project expenses to the payment that caused
-- the actual spend. This avoids losing traceability when Gap #4 formalizes the
-- committed -> paid/spent accounting transitions.
alter table public.project_expenses
  add column if not exists payment_request_id uuid references public.payment_requests(id) on delete set null;
create index if not exists project_expenses_payment_request_idx
  on public.project_expenses(payment_request_id) where payment_request_id is not null;

-- -----------------------------------------------------------------------------
-- Updated-at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists funding_sources_set_updated_at on public.funding_sources;
create trigger funding_sources_set_updated_at before update on public.funding_sources
for each row execute function public.set_updated_at();

drop trigger if exists budget_requests_set_updated_at on public.budget_requests;
create trigger budget_requests_set_updated_at before update on public.budget_requests
for each row execute function public.set_updated_at();

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;
create trigger payment_requests_set_updated_at before update on public.payment_requests
for each row execute function public.set_updated_at();

drop trigger if exists customer_invoice_requests_set_updated_at on public.customer_invoice_requests;
create trigger customer_invoice_requests_set_updated_at before update on public.customer_invoice_requests
for each row execute function public.set_updated_at();

drop trigger if exists customer_invoices_set_updated_at on public.customer_invoices;
create trigger customer_invoices_set_updated_at before update on public.customer_invoices
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Baseline RLS. Gap #3 will replace these broad role/project rules with granular
-- finance permissions. Until then, sensitive finance data is not open to all staff.
-- -----------------------------------------------------------------------------
alter table public.funding_sources enable row level security;
alter table public.project_funding_sources enable row level security;
alter table public.budget_requests enable row level security;
alter table public.payment_requests enable row level security;
alter table public.customer_invoice_requests enable row level security;
alter table public.customer_invoices enable row level security;
alter table public.financial_documents enable row level security;

-- Funding source master data: Finance and platform admins manage it; project users
-- can read sources attached to projects they can view.
drop policy if exists funding_sources_read on public.funding_sources;
create policy funding_sources_read on public.funding_sources for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or exists (
    select 1 from public.project_funding_sources pfs
    where pfs.funding_source_id = funding_sources.id
      and app_private.can_project(pfs.project_id,'view')
  )
);
drop policy if exists funding_sources_manage on public.funding_sources;
create policy funding_sources_manage on public.funding_sources for all to authenticated
using (app_private.current_role() in ('CEO','ADMIN','FINANCE'))
with check (app_private.current_role() in ('CEO','ADMIN','FINANCE'));

drop policy if exists project_funding_sources_read on public.project_funding_sources;
create policy project_funding_sources_read on public.project_funding_sources for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE') or app_private.can_project(project_id,'view')
);
drop policy if exists project_funding_sources_manage on public.project_funding_sources;
create policy project_funding_sources_manage on public.project_funding_sources for all to authenticated
using (app_private.current_role() in ('CEO','ADMIN','FINANCE'))
with check (app_private.current_role() in ('CEO','ADMIN','FINANCE'));

-- Request records: Finance/CEO/Admin see all; project members see their project;
-- requester ownership is also respected. Write scope is intentionally conservative.
drop policy if exists budget_requests_read on public.budget_requests;
create policy budget_requests_read on public.budget_requests for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or requested_by = (select auth.uid())
  or app_private.can_project(project_id,'view')
);
drop policy if exists budget_requests_insert on public.budget_requests;
create policy budget_requests_insert on public.budget_requests for insert to authenticated with check (
  requested_by = (select auth.uid()) and app_private.can_project(project_id,'create')
);
drop policy if exists budget_requests_update on public.budget_requests;
create policy budget_requests_update on public.budget_requests for update to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or (requested_by = (select auth.uid()) and current_status in ('DRAFT','MODIFICATION_REQUIRED'))
) with check (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or requested_by = (select auth.uid())
);

drop policy if exists payment_requests_read on public.payment_requests;
create policy payment_requests_read on public.payment_requests for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or requested_by = (select auth.uid())
  or app_private.can_project(project_id,'view')
);
drop policy if exists payment_requests_insert on public.payment_requests;
create policy payment_requests_insert on public.payment_requests for insert to authenticated with check (
  requested_by = (select auth.uid()) and app_private.can_project(project_id,'create')
);
drop policy if exists payment_requests_update on public.payment_requests;
create policy payment_requests_update on public.payment_requests for update to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or (requested_by = (select auth.uid()) and current_status in ('DRAFT','MODIFICATION_REQUIRED'))
) with check (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or requested_by = (select auth.uid())
);

drop policy if exists customer_invoice_requests_read on public.customer_invoice_requests;
create policy customer_invoice_requests_read on public.customer_invoice_requests for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or requested_by = (select auth.uid())
  or app_private.can_project(project_id,'view')
);
drop policy if exists customer_invoice_requests_insert on public.customer_invoice_requests;
create policy customer_invoice_requests_insert on public.customer_invoice_requests for insert to authenticated with check (
  requested_by = (select auth.uid()) and app_private.can_project(project_id,'create')
);
drop policy if exists customer_invoice_requests_update on public.customer_invoice_requests;
create policy customer_invoice_requests_update on public.customer_invoice_requests for update to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or (requested_by = (select auth.uid()) and current_status in ('DRAFT','MODIFICATION_REQUIRED'))
) with check (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or requested_by = (select auth.uid())
);

-- Issued customer invoices are Finance-controlled, but project viewers and the
-- original requester retain visibility for the dashboard requirement.
drop policy if exists customer_invoices_read on public.customer_invoices;
create policy customer_invoices_read on public.customer_invoices for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or app_private.can_project(project_id,'view')
  or exists (
    select 1 from public.customer_invoice_requests cir
    where cir.id = customer_invoices.invoice_request_id
      and cir.requested_by = (select auth.uid())
  )
);
drop policy if exists customer_invoices_manage on public.customer_invoices;
create policy customer_invoices_manage on public.customer_invoices for all to authenticated
using (app_private.current_role() in ('CEO','ADMIN','FINANCE'))
with check (app_private.current_role() in ('CEO','ADMIN','FINANCE'));

-- Documents inherit visibility from their parent finance record.
drop policy if exists financial_documents_read on public.financial_documents;
create policy financial_documents_read on public.financial_documents for select to authenticated using (
  app_private.current_role() in ('CEO','ADMIN','FINANCE')
  or (entity_type='BUDGET_REQUEST' and exists (
    select 1 from public.budget_requests br where br.id=financial_documents.entity_id
      and (br.requested_by=(select auth.uid()) or app_private.can_project(br.project_id,'view'))
  ))
  or (entity_type='PAYMENT_REQUEST' and exists (
    select 1 from public.payment_requests pr where pr.id=financial_documents.entity_id
      and (pr.requested_by=(select auth.uid()) or app_private.can_project(pr.project_id,'view'))
  ))
  or (entity_type='INVOICE_REQUEST' and exists (
    select 1 from public.customer_invoice_requests ir where ir.id=financial_documents.entity_id
      and (ir.requested_by=(select auth.uid()) or app_private.can_project(ir.project_id,'view'))
  ))
  or (entity_type='CUSTOMER_INVOICE' and exists (
    select 1 from public.customer_invoices ci where ci.id=financial_documents.entity_id
      and app_private.can_project(ci.project_id,'view')
  ))
);
drop policy if exists financial_documents_insert on public.financial_documents;
create policy financial_documents_insert on public.financial_documents for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and (
    app_private.current_role() in ('CEO','ADMIN','FINANCE')
    or (entity_type='BUDGET_REQUEST' and exists (select 1 from public.budget_requests br where br.id=entity_id and br.requested_by=(select auth.uid())))
    or (entity_type='PAYMENT_REQUEST' and exists (select 1 from public.payment_requests pr where pr.id=entity_id and pr.requested_by=(select auth.uid())))
    or (entity_type='INVOICE_REQUEST' and exists (select 1 from public.customer_invoice_requests ir where ir.id=entity_id and ir.requested_by=(select auth.uid())))
  )
);

commit;
