-- SmartCare V5.9 - Gap #6 Customer Invoicing & Accounts Receivable module
begin;

insert into public.app_modules(module_key,title,path,enabled,sort_order)
values('finance_invoicing','Customer Invoicing','/finance/invoicing',true,23)
on conflict(module_key) do update set title=excluded.title,path=excluded.path,enabled=true;

insert into public.user_permissions(user_id,module_key,can_view,can_create,can_edit,can_delete,can_approve)
select p.id,'finance_invoicing',
       upper(r.name) in ('CEO','ADMIN','FINANCE','PROJECT_MANAGER'),
       upper(r.name) in ('CEO','ADMIN','FINANCE','PROJECT_MANAGER'),
       upper(r.name) in ('CEO','ADMIN','FINANCE'),
       upper(r.name) in ('CEO','ADMIN'),
       upper(r.name) in ('CEO','ADMIN','FINANCE')
from public.profiles p join public.roles r on r.id=p.role_id
on conflict(user_id,module_key) do nothing;

commit;
