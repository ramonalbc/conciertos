-- ============================================================
-- Conciertos · migración 002: permitir subir fotos propias
-- Supabase Storage necesita también permiso de lectura (select)
-- para guardar archivos. Pegar en SQL Editor → Run (se puede repetir).
-- ============================================================

drop policy if exists conc_photos_select on storage.objects;
create policy conc_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'conciertos' and public.is_member());

-- Por si el bucket no se llegó a crear
insert into storage.buckets (id, name, public)
values ('conciertos', 'conciertos', true)
on conflict (id) do update set public = true;
