begin;

insert into public.app_modules(module_key,title,path,enabled,sort_order)
values ('order_progress','Order Progress','/order-progress',true,115)
on conflict (module_key) do update set title=excluded.title,path=excluded.path,enabled=true,sort_order=excluded.sort_order;

insert into public.user_permissions(user_id,module_key,can_view,can_create,can_edit,can_delete,can_approve)
select p.id,'order_progress',true,true,true,false,false
from public.profiles p
join public.roles r on r.id=p.role_id
where p.active and r.name in ('ADMIN','MANAGER','FINANCE','TECHNICIAN','STAFF','VIEWER')
on conflict (user_id,module_key) do update set can_view=true,can_create=excluded.can_create,can_edit=excluded.can_edit;

commit;
