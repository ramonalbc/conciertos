-- ============================================================
-- Conciertos · esquema de base de datos (Supabase / PostgreSQL)
-- Mismo proyecto que Findes. Todas las tablas empiezan por conc_
-- para no mezclarse con las de Findes.
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- Reutiliza public.members e is_member() de Findes (Ramón e Irene).
-- ============================================================

-- 1. Artistas (catálogo común: si los dos seguís al mismo, se busca una vez)
create table if not exists public.conc_artists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  name_norm   text not null unique,          -- nombre en minúsculas y sin tildes
  deezer_id   bigint,
  image_url   text,
  created_at  timestamptz not null default now()
);

-- 2. Qué artistas sigue cada uno y en qué zonas
--    zones = lista JSON, por ejemplo:
--    [{"t":"country","v":"ES"}]                      España
--    [{"t":"continent","v":"EU"},{"t":"country","v":"GB"}]  Europa + Reino Unido
--    tipos: world · continent · country · region (CCAA) · province · city
create table if not exists public.conc_follows (
  email       text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  artist_id   uuid not null references public.conc_artists (id) on delete cascade,
  zones       jsonb not null default '[{"t":"world"}]'::jsonb,
  active      boolean not null default true,
  image_url   text,                           -- foto propia (si no, la del catálogo)
  created_at  timestamptz not null default now(),
  primary key (email, artist_id)
);

-- 3. Conciertos encontrados por la búsqueda diaria
create table if not exists public.conc_concerts (
  id             uuid primary key default gen_random_uuid(),
  artist_id      uuid not null references public.conc_artists (id) on delete cascade,
  event_date     date not null,
  event_time     time,
  title          text,                        -- nombre del espectáculo o festival
  venue          text,
  address        text,
  city           text,
  province       text,
  region         text,                        -- código de comunidad autónoma (España)
  country        text not null default 'ES',  -- código ISO de 2 letras
  price          text,
  tickets_url    text,
  tickets_info   text,                        -- p. ej. "en la sede de la peña"
  source_url     text not null,
  source_date    date,                        -- fecha de publicación de la fuente
  status         text not null default 'anunciado'
                 check (status in ('anunciado', 'agotado', 'cancelado', 'aplazado')),
  date_inferred  boolean not null default false,  -- el año no venía en la fuente
  notes          text,
  dedupe_key     text not null unique,        -- artista + fecha + ciudad
  first_seen     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists conc_concerts_date_idx on public.conc_concerts (event_date);
create index if not exists conc_concerts_artist_idx on public.conc_concerts (artist_id);

-- 4. Marcas de cada uno: me interesa / voy / descartado
create table if not exists public.conc_marks (
  email       text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  concert_id  uuid not null references public.conc_concerts (id) on delete cascade,
  mark        text not null check (mark in ('interesa', 'voy', 'descartado')),
  updated_at  timestamptz not null default now(),
  primary key (email, concert_id)
);

-- 5. Registro de cada búsqueda diaria
create table if not exists public.conc_runs (
  id          bigserial primary key,
  ran_at      timestamptz not null default now(),
  artist_id   uuid references public.conc_artists (id) on delete set null,
  found       int not null default 0,
  added       int not null default 0,
  changed     int not null default 0,
  notes       text
);

-- 6. Suscripciones a avisos de Conciertos (separadas de las de Findes)
create table if not exists public.conc_push_subscriptions (
  endpoint    text primary key,
  email       text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  p256dh      text not null,
  auth        text not null,
  device      text,
  created_at  timestamptz not null default now()
);

-- 7. updated_at al día (la función ya existe por Findes; se redefine igual)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists conc_concerts_touch on public.conc_concerts;
create trigger conc_concerts_touch before update on public.conc_concerts
  for each row execute function public.touch_updated_at();
drop trigger if exists conc_marks_touch on public.conc_marks;
create trigger conc_marks_touch before update on public.conc_marks
  for each row execute function public.touch_updated_at();

-- 8. Seguridad
alter table public.conc_artists            enable row level security;
alter table public.conc_follows            enable row level security;
alter table public.conc_concerts           enable row level security;
alter table public.conc_marks              enable row level security;
alter table public.conc_runs               enable row level security;
alter table public.conc_push_subscriptions enable row level security;

-- Catálogo de artistas: lo leen y amplían los dos
drop policy if exists conc_artists_read on public.conc_artists;
create policy conc_artists_read on public.conc_artists
  for select to authenticated using (public.is_member());
drop policy if exists conc_artists_insert on public.conc_artists;
create policy conc_artists_insert on public.conc_artists
  for insert to authenticated with check (public.is_member());
drop policy if exists conc_artists_update on public.conc_artists;
create policy conc_artists_update on public.conc_artists
  for update to authenticated using (public.is_member()) with check (public.is_member());

-- Seguimientos, marcas y avisos: cada uno solo los suyos
drop policy if exists conc_follows_own on public.conc_follows;
create policy conc_follows_own on public.conc_follows for all to authenticated
  using (public.is_member() and email = lower(auth.jwt() ->> 'email'))
  with check (public.is_member() and email = lower(auth.jwt() ->> 'email'));

drop policy if exists conc_marks_own on public.conc_marks;
create policy conc_marks_own on public.conc_marks for all to authenticated
  using (public.is_member() and email = lower(auth.jwt() ->> 'email'))
  with check (public.is_member() and email = lower(auth.jwt() ->> 'email'));

drop policy if exists conc_push_own on public.conc_push_subscriptions;
create policy conc_push_own on public.conc_push_subscriptions for all to authenticated
  using (public.is_member() and email = lower(auth.jwt() ->> 'email'))
  with check (public.is_member() and email = lower(auth.jwt() ->> 'email'));

-- Conciertos y registro: solo lectura desde la app (los escribe la búsqueda diaria)
drop policy if exists conc_concerts_read on public.conc_concerts;
create policy conc_concerts_read on public.conc_concerts
  for select to authenticated using (public.is_member());
drop policy if exists conc_runs_read on public.conc_runs;
create policy conc_runs_read on public.conc_runs
  for select to authenticated using (public.is_member());

-- 9. Fotos subidas a mano (bucket público "conciertos")
insert into storage.buckets (id, name, public)
values ('conciertos', 'conciertos', true)
on conflict (id) do update set public = true;

drop policy if exists conc_photos_insert on storage.objects;
create policy conc_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'conciertos' and public.is_member());
drop policy if exists conc_photos_update on storage.objects;
create policy conc_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'conciertos' and public.is_member());
drop policy if exists conc_photos_delete on storage.objects;
create policy conc_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'conciertos' and public.is_member());

-- 10. Datos iniciales de Ramón: sus dos artistas y el concierto de la prueba
insert into public.conc_artists (name, name_norm) values
  ('Ezequiel Benítez', 'ezequiel benitez'),
  ('Tedeschi Trucks Band', 'tedeschi trucks band')
on conflict (name_norm) do nothing;

insert into public.conc_follows (email, artist_id, zones)
select 'ramonalbc@gmail.com', id, '[{"t":"country","v":"ES"}]'::jsonb
  from public.conc_artists where name_norm = 'ezequiel benitez'
on conflict (email, artist_id) do nothing;

insert into public.conc_follows (email, artist_id, zones)
select 'ramonalbc@gmail.com', id, '[{"t":"continent","v":"EU"},{"t":"country","v":"GB"}]'::jsonb
  from public.conc_artists where name_norm = 'tedeschi trucks band'
on conflict (email, artist_id) do nothing;

insert into public.conc_concerts (
  artist_id, event_date, event_time, title, venue, city, province, region, country,
  price, tickets_info, source_url, source_date, date_inferred, notes, dedupe_key
)
select id, date '2026-11-26', time '20:00',
  'X Festival Flamenco de las Peñas Cordobesas (Memorial Agustín Gómez)',
  'Teatro Góngora', 'Córdoba', 'Córdoba', 'AN', 'ES',
  '3 €',
  'Venta el lunes 23 de noviembre en la sede de la Federación de Peñas Cordobesas (calle Corto Maltés). La recaudación va al Banco de Alimentos.',
  'https://www.cordobahoy.es/cultura/x-festival-flamenco-penas-cordobesas-reunira-dia/20261117205128205920.html',
  date '2026-11-17', true,
  'Con Paco León (guitarra), Richard Gutiérrez y Alberto Parraguilla (palmas).',
  id::text || '|2026-11-26|cordoba'
  from public.conc_artists where name_norm = 'ezequiel benitez'
on conflict (dedupe_key) do nothing;
