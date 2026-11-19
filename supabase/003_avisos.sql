-- ============================================================
-- Conciertos · migración 003: avisos al iPhone
-- Reutiliza la función "notify" y la configuración privada (app_config) de Findes.
-- Pegar en Supabase → SQL Editor → Run (se puede repetir).
-- ============================================================

create extension if not exists pg_net;

-- 1. Utilidades
create or replace function public.conc_norm(s text) returns text language sql immutable as $$
  select translate(lower(trim(coalesce(s, ''))), 'áéíóúüñàèìòùâêîôûäëïöçã', 'aeiouunaeiouaeiouaeioca');
$$;

create or replace function public.conc_dia(d date) returns text language sql immutable as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from d)::int + 1]
      || ' ' || extract(day from d)::int || ' '
      || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from d)::int];
$$;

create or replace function public.conc_continent(cc text) returns text language sql immutable as $$
  select case
    when cc = any (string_to_array('AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GI GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK', ' ')) then 'EU'
    when cc = any (string_to_array('AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA PR SV TT US VC', ' ')) then 'NA'
    when cc = any (string_to_array('AR BO BR CL CO EC GY PE PY SR UY VE', ' ')) then 'SA'
    when cc = any (string_to_array('AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE', ' ')) then 'AS'
    when cc = any (string_to_array('AU FJ NZ PG SB VU WS TO', ' ')) then 'OC'
    when cc is not null then 'AF'
  end;
$$;

-- ¿Cae el concierto en alguna de las zonas? (misma lógica que la app)
create or replace function public.conc_in_zone(c public.conc_concerts, zones jsonb) returns boolean
language sql stable as $$
  select zones is null or jsonb_array_length(zones) = 0 or exists (
    select 1 from jsonb_array_elements(zones) z
    where case z->>'t'
      when 'world'     then true
      when 'continent' then public.conc_continent(c.country) = z->>'v'
      when 'country'   then c.country = z->>'v'
      when 'region'    then c.country = 'ES' and c.region = z->>'v'
      when 'province'  then c.country = 'ES' and public.conc_norm(c.province) = public.conc_norm(z->>'v')
      when 'city'      then (z->>'c' is null or c.country = z->>'c') and public.conc_norm(c.city) = public.conc_norm(z->>'v')
      else false
    end
  );
$$;

-- 2. Envío a los iPhone de una persona (usa la función notify de Findes)
create or replace function public.conc_send_push(p_email text, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; v_url text; v_secret text;
begin
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into subs from conc_push_subscriptions where email = p_email;
  if jsonb_array_length(subs) = 0 then return; end if;
  select value into v_url from app_config where key = 'notify_url';
  select value into v_secret from app_config where key = 'notify_secret';
  if v_url is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('title', p_title, 'body', p_body, 'url', p_url, 'subs', subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-findes-secret', v_secret)
  );
end;
$$;

-- 3. Conciertos nuevos: un aviso por persona y artista (agrupa si llegan varios a la vez)
create or replace function public.conc_on_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; t text; b text; u text;
begin
  for r in
    select f.email, a.id as artist_id, a.name,
           count(*) as n,
           (array_agg(n.id order by n.event_date))[1] as first_id,
           string_agg(conc_dia(n.event_date) || ' ' || coalesce(n.city, ''), ' · ' order by n.event_date) as lista,
           (array_agg(conc_dia(n.event_date)
              || coalesce(' · ' || left(n.event_time::text, 5), '')
              || ' · ' || concat_ws(', ', n.venue, n.city) order by n.event_date))[1] as primero
      from nuevos n
      join conc_follows f on f.artist_id = n.artist_id and f.active
      join conc_artists a on a.id = n.artist_id
     where conc_in_zone(n::conc_concerts, f.zones) and n.event_date >= current_date
     group by f.email, a.id, a.name
  loop
    if r.n = 1 then
      t := '🎤 ' || r.name || ': nuevo concierto';
      b := r.primero;
      u := '#/concierto/' || r.first_id;
    else
      t := '🎤 ' || r.name || ': ' || r.n || ' conciertos nuevos';
      b := left(r.lista, 180);
      u := '#/artista/' || r.artist_id;
    end if;
    perform conc_send_push(r.email, t, b, u);
  end loop;
  return null;
end;
$$;

drop trigger if exists conc_concerts_new on public.conc_concerts;
create trigger conc_concerts_new after insert on public.conc_concerts
  referencing new table as nuevos
  for each statement execute function public.conc_on_insert();

-- 4. Cambios importantes en un concierto: cancelado, aplazado, agotado, cambio de fecha, hora o lugar
create or replace function public.conc_on_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; t text; b text; artist text; what text := null;
begin
  if new.event_date < current_date then return new; end if;
  if new.status is distinct from old.status and new.status <> 'anunciado' then
    what := case new.status when 'cancelado' then 'cancelado' when 'aplazado' then 'aplazado' else 'entradas agotadas' end;
  elsif new.event_date is distinct from old.event_date then what := 'cambio de fecha';
  elsif new.event_time is distinct from old.event_time and old.event_time is not null then what := 'cambio de hora';
  elsif new.venue is distinct from old.venue and old.venue is not null then what := 'cambio de lugar';
  end if;
  if what is null then return new; end if;

  select name into artist from conc_artists where id = new.artist_id;
  t := case when new.status in ('cancelado', 'aplazado') then '⚠️ ' else '🔔 ' end || artist || ': ' || what;
  b := conc_dia(new.event_date) || coalesce(' · ' || left(new.event_time::text, 5), '') || ' · ' || concat_ws(', ', new.venue, new.city);

  for r in
    select f.email, m.mark
      from conc_follows f
      left join conc_marks m on m.concert_id = new.id and m.email = f.email
     where f.artist_id = new.artist_id and f.active and conc_in_zone(new, f.zones)
  loop
    continue when r.mark = 'descartado';
    continue when new.status = 'agotado' and new.status is distinct from old.status and r.mark = 'voy'; -- ya tiene entrada
    perform conc_send_push(r.email, t, b, '#/concierto/' || new.id);
  end loop;
  return new;
end;
$$;

drop trigger if exists conc_concerts_changed on public.conc_concerts;
create trigger conc_concerts_changed after update on public.conc_concerts
  for each row execute function public.conc_on_update();

-- 5. Aviso de prueba a tus propios dispositivos (botón en Ajustes)
create or replace function public.conc_test_push() returns void
language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not is_member() then raise exception 'sin acceso'; end if;
  perform conc_send_push(me, 'Conciertos', 'Los avisos funcionan en este iPhone 🎶', '#/');
end;
$$;
grant execute on function public.conc_test_push() to authenticated;
