-- Private document storage. Files must be stored under a first path segment equal to the member UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ventora-private-documents','ventora-private-documents',false,15728640,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ventora_private_documents_read on storage.objects;
create policy ventora_private_documents_read on storage.objects for select to authenticated
using(bucket_id='ventora-private-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

drop policy if exists ventora_private_documents_upload on storage.objects;
create policy ventora_private_documents_upload on storage.objects for insert to authenticated
with check(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists ventora_private_documents_update on storage.objects;
create policy ventora_private_documents_update on storage.objects for update to authenticated
using(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists ventora_private_documents_delete on storage.objects;
create policy ventora_private_documents_delete on storage.objects for delete to authenticated
using(bucket_id='ventora-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
