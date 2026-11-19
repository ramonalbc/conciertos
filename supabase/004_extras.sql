-- ============================================================
-- Conciertos · migración 004: recordatorios, "Buscar ahora",
-- salida a la venta, enlace con Findes y mapa.
-- Pegar en Supabase → SQL Editor → Run (se puede repetir).
-- ============================================================

-- 1. Nuevos campos
alter table public.conc_marks    add column if not exists reminders int[] not null default '{}';  -- días de antelación (0 = el mismo día)
alter table public.conc_marks    add column if not exists findes_plan_id uuid;                     -- plan creado en Findes
alter table public.conc_concerts add column if not exists on_sale_date date;                       -- salida a la venta de entradas
alter table public.conc_concerts add column if not exists on_sale_time time;
alter table public.conc_concerts add column if not exists lat double precision;                    -- para el mapa
alter table public.conc_concerts add column if not exists lng double precision;

-- 2. Peticiones de "Buscar ahora"
create table if not exists public.conc_search_requests (
  id          bigserial primary key,
  artist_id   uuid not null references public.conc_artists (id) on delete cascade,
  email       text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
alter table public.conc_search_requests enable row level security;
drop policy if exists conc_req_read on public.conc_search_requests;
create policy conc_req_read on public.conc_search_requests
  for select to authenticated using (public.is_member());
drop policy if exists conc_req_insert on public.conc_search_requests;
create policy conc_req_insert on public.conc_search_requests
  for insert to authenticated with check (public.is_member() and email = lower(auth.jwt() ->> 'email'));

-- 3. Registro de avisos diarios ya enviados (para no repetir)
create table if not exists public.conc_notices_sent (
  email       text not null,
  concert_id  uuid not null references public.conc_concerts (id) on delete cascade,
  kind        text not null,            -- 'recordatorio' | 'venta'
  ref         int  not null default 0,  -- días de antelación del recordatorio
  sent_at     timestamptz not null default now(),
  primary key (email, concert_id, kind, ref)
);
alter table public.conc_notices_sent enable row level security;  -- sin políticas: solo uso interno

-- 4. Avisos diarios: recordatorios de "Voy" y salida a la venta
create or replace function public.conc_daily_notices() returns int
language plpgsql security definer set search_path = public as $$
declare r record; d int; t text; b text; sent int := 0;
begin
  -- 4a. Recordatorios de los conciertos a los que voy
  for r in
    select m.email, c.*, a.name as artist, (c.event_date - current_date) as faltan
      from conc_marks m
      join conc_concerts c on c.id = m.concert_id
      join conc_artists a on a.id = c.artist_id
     where m.mark = 'voy'
       and c.status <> 'cancelado'
       and (c.event_date - current_date) = any (m.reminders)
       and not exists (select 1 from conc_notices_sent s
                        where s.email = m.email and s.concert_id = c.id and s.kind = 'recordatorio'
                          and s.ref = (c.event_date - current_date))
  loop
    d := r.faltan;
    t := '⏰ ' || case when d = 0 then 'Hoy' when d = 1 then 'Mañana' when d = 7 then 'En una semana'
                       when d = 15 then 'En 15 días' when d = 30 then 'En un mes' else 'En ' || d || ' días' end
         || ': ' || r.artist;
    b := conc_dia(r.event_date) || coalesce(' · ' || left(r.event_time::text, 5), '') || ' · ' || concat_ws(', ', r.venue, r.city);
    perform conc_send_push(r.email, t, b, '#/concierto/' || r.id);
    insert into conc_notices_sent (email, concert_id, kind, ref) values (r.email, r.id, 'recordatorio', d) on conflict do nothing;
    sent := sent + 1;
  end loop;

  -- 4b. Hoy salen a la venta las entradas (a quien sigue al artista en esa zona, salvo si ya va u ocultó el concierto)
  for r in
    select f.email, c.*, a.name as artist
      from conc_concerts c
      join conc_follows f on f.artist_id = c.artist_id and f.active
      join conc_artists a on a.id = c.artist_id
      left join conc_marks m on m.concert_id = c.id and m.email = f.email
     where c.on_sale_date = current_date
       and c.event_date >= current_date
       and c.status = 'anunciado'
       and conc_in_zone(c, f.zones)
       and coalesce(m.mark, '') not in ('voy', 'descartado')
       and not exists (select 1 from conc_notices_sent s
                        where s.email = f.email and s.concert_id = c.id and s.kind = 'venta')
  loop
    t := '🎟️ Hoy salen las entradas: ' || r.artist;
    b := coalesce('A las ' || left(r.on_sale_time::text, 5) || ' · ', '')
         || conc_dia(r.event_date) || ' · ' || concat_ws(', ', r.venue, r.city);
    perform conc_send_push(r.email, t, b, '#/concierto/' || r.id);
    insert into conc_notices_sent (email, concert_id, kind, ref) values (r.email, r.id, 'venta', 0) on conflict do nothing;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

-- 5. Programarlo cada día a las 08:00 UTC (09:00 en invierno / 10:00 en verano, hora de España)
create extension if not exists pg_cron;
select cron.schedule('conciertos-avisos-diarios', '0 8 * * *', 'select public.conc_daily_notices()');
