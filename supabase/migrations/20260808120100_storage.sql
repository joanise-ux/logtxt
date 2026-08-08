-- Prywatny bucket na nagrania głosowe i zdjęcia z wpisów/notatek.
-- Konwencja ścieżki: <user_id>/<rodzaj>/<plik>, np. "a1b2.../voice/2026-08-08_12-01.webm".
-- Pierwszy segment ścieżki decyduje o właścicielu — na tym opierają się polityki niżej.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  52428800, -- 50 MB; nagranie i tak nie przekroczy limitu API transkrypcji (25 MB)
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
        'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own media read"   on storage.objects;
drop policy if exists "own media write"  on storage.objects;
drop policy if exists "own media update" on storage.objects;
drop policy if exists "own media delete" on storage.objects;

create policy "own media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own media write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
