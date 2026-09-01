-- SmartCare profile self-service contact details and avatars.
begin;

alter table public.profiles
  add column if not exists address text not null default '',
  add column if not exists avatar_url text not null default '',
  add column if not exists role_summary text not null default '';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "Users upload their own profile avatar"
on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "Users replace their own profile avatar"
on storage.objects for update to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "Users read profile avatars"
on storage.objects for select to authenticated
using (bucket_id='profile-avatars');

create policy "Users delete their own profile avatar"
on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
