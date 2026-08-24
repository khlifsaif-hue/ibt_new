begin;

alter table public.purchase_requests
  add column if not exists optional_attachment_path text,
  add column if not exists optional_attachment_name text;

create table if not exists public.purchase_request_approvals (
  id bigint generated always as identity primary key,
  purchase_request_id text not null references public.purchase_requests(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  approver_role text not null check (approver_role in ('PROJECT_MANAGER','CEO','FINANCE','ADMIN')),
  decision text not null check (decision in ('approved','rejected')),
  signature_text text not null check (length(trim(signature_text)) >= 2),
  signed_at timestamptz not null default now(),
  unique (purchase_request_id, approver_id)
);

create index if not exists purchase_request_approvals_request_idx
  on public.purchase_request_approvals(purchase_request_id, signed_at);

alter table public.purchase_request_approvals enable row level security;

drop policy if exists purchase_request_approvals_read on public.purchase_request_approvals;
create policy purchase_request_approvals_read
on public.purchase_request_approvals for select to authenticated
using (
  exists (
    select 1 from public.purchase_requests pr
    where pr.id=purchase_request_id
      and (pr.requester_user_id=(select auth.uid()) or app_private.can_project(pr.project_id,'view'))
  )
);

drop policy if exists purchase_request_approvals_create on public.purchase_request_approvals;
create policy purchase_request_approvals_create
on public.purchase_request_approvals for insert to authenticated
with check (
  approver_id=(select auth.uid())
  and approver_role=app_private.current_role()
  and app_private.current_role() in ('PROJECT_MANAGER','CEO','FINANCE','ADMIN')
  and exists (
    select 1 from public.purchase_requests pr
    where pr.id=purchase_request_id and app_private.can_project(pr.project_id,'view')
  )
);

grant select,insert on public.purchase_request_approvals to authenticated;
grant usage,select on sequence public.purchase_request_approvals_id_seq to authenticated;

update storage.buckets
set allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp']
where id='purchase-order-pdfs';

drop policy if exists storage_owner_read on storage.objects;
create policy storage_owner_read on storage.objects for select to authenticated using (
  bucket_id in ('asset-images','diagnostic-images','purchase-order-pdfs','reports','manuals')
  and (
    owner_id=(select auth.uid())::text
    or exists(select 1 from public.assets a where a.image_path=name and app_private.can_project(a.project_id,'view'))
    or exists(select 1 from public.projects p where p.image_path=name and app_private.can_project(p.id,'view'))
    or (
      bucket_id='purchase-order-pdfs'
      and exists (
        select 1 from public.purchase_requests pr
        where (pr.proforma_invoice_path=name or pr.optional_attachment_path=name)
          and (pr.requester_user_id=(select auth.uid()) or app_private.can_project(pr.project_id,'view'))
      )
    )
  )
);

comment on table public.purchase_request_approvals is
  'Immutable electronic approval signatures for purchase requests.';
comment on column public.purchase_requests.optional_attachment_path is
  'Private Storage path for an optional supporting attachment.';

commit;
