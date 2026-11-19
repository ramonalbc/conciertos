import { SUPABASE_URL, SUPABASE_KEY, APP_VERSION, SEARCH_HOUR, ARTIST_COLORS } from './config.js';
import {
  CONTINENTS, REGIONS_ES, PROVINCES_ES, countryName, countriesOf, allCountries, provincesOf,
  norm, inZone, zoneLabel, zoneKey,
} from './geo.js';
import { searchArtists } from './deezer.js';

// ------------------------------------------------------------------ utilidades

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => isoOf(new Date());
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const diffDays = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const fmtShort = (iso) => { const d = parseIso(iso); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
const fmtLong = (iso) => { const d = parseIso(iso); return `${DOW_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`; };
const fmtTime = (t) => (t ? t.slice(0, 5) : '');
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return u; } };

function countdown(iso) {
  const n = diffDays(todayIso(), iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n < 0) return `Hace ${-n} días`;
  return `En ${n} días`;
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  calplus: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
};
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

const STATUS = {
  anunciado: null,
  agotado: { label: 'Agotado', cls: 'warn' },
  cancelado: { label: 'Cancelado', cls: 'bad' },
  aplazado: { label: 'Aplazado', cls: 'warn' },
};

const MARKS = {
  interesa: { label: 'Me interesa', icon: 'star' },
  voy: { label: 'Voy', icon: 'ticket' },
};

// ------------------------------------------------------------------ estado

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'conciertos-auth' },
});

const S = {
  session: null,
  me: null,
  loaded: false,
  error: null,
  artists: {},       // id → artista del catálogo
  follows: [],       // mis seguimientos
  concerts: [],
  marks: {},         // concierto → marca
  runs: [],
  // calendario y filtros
  calView: 'mes',
  calMonth: todayIso().slice(0, 7),
  calDay: null,
  fMark: 'todos',
  fCountry: '', fProvince: '', fCity: '', fArtist: '',
  sheet: null,       // hoja inferior abierta: 'filtros' | 'zona' | 'foto' | 'borrar'
  zoneDraft: null,   // { t, v, c }
  // alta de artista
  add: null,         // { q, results, loading, picked, zones, manual }
  photo: null,       // { results, loading }
  imgTried: new Set(),
};

let lastSeen = null;
try { lastSeen = localStorage.getItem('conciertos-visto'); } catch (_) { /* nada */ }

// ------------------------------------------------------------------ datos

async function loadAll() {
  const since = isoOf(new Date(Date.now() - 400 * 86400000));
  const [me, ar, fo, co, mk, ru] = await Promise.all([
    sb.from('members').select('*').eq('email', S.session.user.email.toLowerCase()).maybeSingle(),
    sb.from('conc_artists').select('*'),
    sb.from('conc_follows').select('*').order('created_at'),
    sb.from('conc_concerts').select('*').gte('event_date', since).order('event_date').order('event_time'),
    sb.from('conc_marks').select('*'),
    sb.from('conc_runs').select('*').order('ran_at', { ascending: false }).limit(20),
  ]);
  for (const r of [me, ar, fo, co, mk, ru]) if (r.error) throw r.error;
  if (!me.data) throw new Error('Este usuario no tiene acceso a la app.');
  S.me = me.data;
  S.artists = Object.fromEntries(ar.data.map((a) => [a.id, a]));
  S.follows = fo.data;
  S.concerts = co.data;
  S.marks = Object.fromEntries(mk.data.map((m) => [m.concert_id, m.mark]));
  S.runs = ru.data;
  S.loaded = true;
  fillMissingImages();
}

// Si un artista aún no tiene foto, se busca una vez en Deezer
async function fillMissingImages() {
  for (const f of S.follows) {
    const a = S.artists[f.artist_id];
    if (!a || a.image_url || S.imgTried.has(a.id)) continue;
    S.imgTried.add(a.id);
    try {
      const res = await searchArtists(a.name, 5);
      const hit = res.find((r) => norm(r.name) === a.name_norm) || null;
      if (!hit) continue;
      const r = await sb.from('conc_artists').update({ image_url: hit.image, deezer_id: hit.id }).eq('id', a.id).select().single();
      if (!r.error) { S.artists[a.id] = r.data; softRender(); }
    } catch (_) { /* sin foto */ }
  }
}

const followOf = (artistId) => S.follows.find((f) => f.artist_id === artistId);
const artistImg = (artistId) => { const f = followOf(artistId); return (f && f.image_url) || S.artists[artistId]?.image_url || null; };
function artistColor(artistId) {
  const i = S.follows.findIndex((f) => f.artist_id === artistId);
  return ARTIST_COLORS[(i < 0 ? 0 : i) % ARTIST_COLORS.length];
}
const artistName = (id) => S.artists[id]?.name || '¿?';

// Conciertos que me tocan: artistas que sigo (activos) y dentro de sus zonas
function myConcerts({ includePast = false, includeDiscarded = false } = {}) {
  const t = todayIso();
  return S.concerts.filter((c) => {
    const f = followOf(c.artist_id);
    if (!f || !f.active) return false;
    if (!inZone(c, f.zones)) return false;
    if (!includePast && c.event_date < t) return false;
    if (!includeDiscarded && S.marks[c.id] === 'descartado') return false;
    return true;
  });
}

function filtered(list) {
  return list.filter((c) => {
    if (S.fMark === 'interesa' && S.marks[c.id] !== 'interesa' && S.marks[c.id] !== 'voy') return false;
    if (S.fMark === 'voy' && S.marks[c.id] !== 'voy') return false;
    if (S.fCountry && c.country !== S.fCountry) return false;
    if (S.fProvince && c.province !== S.fProvince) return false;
    if (S.fCity && norm(c.city) !== norm(S.fCity)) return false;
    if (S.fArtist && c.artist_id !== S.fArtist) return false;
    return true;
  });
}
const activeFilters = () => [S.fCountry, S.fProvince, S.fCity, S.fArtist].filter(Boolean).length;

// ------------------------------------------------------------------ rutas

function route() {
  const p = (location.hash || '#/').slice(2).split('/');
  switch (p[0]) {
    case '': return { name: 'inicio' };
    case 'calendario': return { name: 'calendario' };
    case 'artistas': return { name: 'artistas' };
    case 'nuevo': return { name: 'nuevo' };
    case 'artista': return { name: 'artista', id: p[1] };
    case 'concierto': return { name: 'concierto', id: p[1] };
    case 'ajustes': return { name: 'ajustes' };
    default: return { name: 'inicio' };
  }
}

// ------------------------------------------------------------------ piezas

function avatar(artistId, cls = '') {
  const img = artistImg(artistId);
  const name = artistName(artistId);
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const col = artistColor(artistId);
  if (img) return `<div class="av ${cls}" style="--c:${col}"><img src="${esc(img)}" alt="" loading="lazy"></div>`;
  return `<div class="av ${cls} noimg" style="--c:${col}"><span>${esc(ini)}</span></div>`;
}

function placeLine(c) {
  const parts = [c.venue, c.city];
  if (c.country !== 'ES') parts.push(countryName(c.country));
  else if (c.province && norm(c.province) !== norm(c.city)) parts.push(c.province);
  return parts.filter(Boolean).join(' · ');
}

function markBadge(c) {
  const m = S.marks[c.id];
  if (m === 'voy') return `<span class="badge voy">${ico('ticket')}Voy</span>`;
  if (m === 'interesa') return `<span class="badge int">${ico('star')}Me interesa</span>`;
  return '';
}
function statusBadge(c) {
  const s = STATUS[c.status];
  return s ? `<span class="badge ${s.cls}">${s.label}</span>` : '';
}
const isNew = (c) => lastSeen && c.first_seen > lastSeen;

function concertCard(c, { showArtist = true } = {}) {
  const d = parseIso(c.event_date);
  return `
  <a class="ccard ${c.status === 'cancelado' ? 'off' : ''}" href="#/concierto/${c.id}" style="--c:${artistColor(c.artist_id)}">
    <div class="cdate"><span class="cd-m">${MONTHS_SHORT[d.getMonth()]}</span><span class="cd-d">${d.getDate()}</span><span class="cd-w">${DOW_SHORT[d.getDay()]}</span></div>
    <div class="cinfo">
      ${showArtist ? `<div class="c-art">${esc(artistName(c.artist_id))}${isNew(c) ? '<span class="newdot">Nuevo</span>' : ''}</div>` : ''}
      <div class="c-place ellipsis">${esc(placeLine(c))}</div>
      <div class="c-meta">${c.event_time ? `<span>${fmtTime(c.event_time)}</span>` : ''}${statusBadge(c)}${markBadge(c)}</div>
    </div>
    ${showArtist ? avatar(c.artist_id, 'sm') : ''}
  </a>`;
}

function tabbar(active) {
  const t = (name, href, icon, label) => `<a class="tab ${active === name ? 'on' : ''}" href="${href}">${ico(icon)}<span>${label}</span></a>`;
  return `<nav class="tabbar">${t('inicio', '#/', 'home', 'Inicio')}${t('calendario', '#/calendario', 'cal', 'Calendario')}${t('artistas', '#/artistas', 'mic', 'Artistas')}${t('ajustes', '#/ajustes', 'gear', 'Ajustes')}</nav>`;
}

const navBack = (href, label = 'Atrás', right = '') => `<div class="nav"><a href="${href}">${ico('back')}<span>${label}</span></a>${right}</div>`;

// ------------------------------------------------------------------ pantallas

function viewLogin() {
  return `
  <div class="login">
    <div class="beam"></div>
    <div class="login-in">
      <img class="login-icon" src="icons/icon-192.png" alt="">
      <h1>Conciertos</h1>
      <p class="muted">Entra con el mismo usuario que en Findes.</p>
      <form id="login-form" class="stack">
        <input name="email" type="email" autocomplete="username" placeholder="Email" required>
        <input name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required>
        <button class="btn primary" type="submit">Entrar</button>
        <div id="login-error" class="err"></div>
      </form>
    </div>
  </div>`;
}

function viewInicio() {
  const all = myConcerts();
  const going = all.filter((c) => S.marks[c.id] === 'voy' && c.status !== 'cancelado');
  const next = going[0];
  const news = all.filter(isNew);
  const soon = all.slice(0, 8);
  const name = S.me?.name || '';

  let hero = '';
  if (next) {
    hero = `
    <a class="hero" href="#/concierto/${next.id}" style="--c:${artistColor(next.artist_id)}">
      ${artistImg(next.artist_id) ? `<img src="${esc(artistImg(next.artist_id))}" alt="">` : ''}
      <div class="hero-shade"></div>
      <div class="hero-txt">
        <span class="eyebrow">Tu próximo concierto · ${countdown(next.event_date)}</span>
        <strong>${esc(artistName(next.artist_id))}</strong>
        <span>${esc(fmtShort(next.event_date))}${next.event_time ? ' · ' + fmtTime(next.event_time) : ''} · ${esc(next.venue || next.city || '')}</span>
      </div>
    </a>`;
  }

  let body;
  if (!S.follows.length) {
    body = `
    <div class="empty">
      ${ico('mic', 'big')}
      <h3>Aún no sigues a nadie</h3>
      <p class="muted">Añade artistas o grupos y cada mañana buscaré sus conciertos en las zonas que elijas.</p>
      <a class="btn primary" href="#/nuevo">${ico('plus')}Añadir artista</a>
    </div>`;
  } else {
    body = `
      ${news.length ? `<h2 class="sec">${ico('spark')}Novedades <span class="count">${news.length}</span></h2><div class="stack-s">${news.map((c) => concertCard(c)).join('')}</div>` : ''}
      <h2 class="sec">Próximamente</h2>
      ${soon.length ? `<div class="stack-s">${soon.map((c) => concertCard(c)).join('')}</div>
        ${all.length > soon.length ? `<a class="more" href="#/calendario">Ver los ${all.length} conciertos ${ico('right')}</a>` : ''}`
        : `<div class="empty sm"><p class="muted">No hay conciertos anunciados en tus zonas por ahora. Te avisaré en cuanto salga alguno.</p></div>`}
    `;
  }

  return `
  <div class="screen">
    <header class="top">
      <span class="eyebrow">${name ? `Hola, ${esc(name)}` : ''}</span>
      <h1>Conciertos</h1>
    </header>
    <div class="pad stack">
      ${hero}
      ${body}
    </div>
  </div>
  ${tabbar('inicio')}`;
}

function markChips() {
  const chip = (k, label) => `<button class="fchip ${S.fMark === k ? 'on' : ''}" data-act="fmark" data-v="${k}">${label}</button>`;
  const n = activeFilters();
  return `<div class="filters">
    ${chip('todos', 'Todos')}${chip('interesa', `${ico('star')}Me interesa`)}${chip('voy', `${ico('ticket')}Voy`)}
    <button class="fchip icon ${n ? 'on' : ''}" data-act="sheet" data-v="filtros">${ico('filter')}${n ? `<b>${n}</b>` : ''}</button>
  </div>`;
}

function filterSummary() {
  const items = [];
  if (S.fArtist) items.push(['fArtist', artistName(S.fArtist)]);
  if (S.fCountry) items.push(['fCountry', countryName(S.fCountry)]);
  if (S.fProvince) items.push(['fProvince', S.fProvince]);
  if (S.fCity) items.push(['fCity', S.fCity]);
  if (!items.length) return '';
  return `<div class="fsum">${items.map(([k, l]) => `<button class="tag" data-act="fclear" data-v="${k}">${esc(l)} ${ico('x')}</button>`).join('')}</div>`;
}

function viewCalendario() {
  const list = filtered(myConcerts({ includePast: S.calView === 'mes' }));
  const [y, m] = S.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes = 0
  const daysIn = new Date(y, m, 0).getDate();
  const byDay = {};
  for (const c of list) if (c.event_date.startsWith(S.calMonth)) (byDay[c.event_date] ||= []).push(c);
  const t = todayIso();

  let grid = '';
  if (S.calView === 'mes') {
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push('<div class="cell blank"></div>');
    for (let d = 1; d <= daysIn; d++) {
      const iso = `${S.calMonth}-${pad(d)}`;
      const cs = byDay[iso] || [];
      const dots = [...new Set(cs.map((c) => c.artist_id))].slice(0, 4)
        .map((a) => `<i style="background:${artistColor(a)}"></i>`).join('');
      const going = cs.some((c) => S.marks[c.id] === 'voy');
      cells.push(`<button class="cell ${iso === t ? 'today' : ''} ${iso === S.calDay ? 'sel' : ''} ${cs.length ? 'has' : ''} ${going ? 'going' : ''} ${iso < t ? 'past' : ''}" data-act="day" data-v="${iso}">
        <span>${d}</span><div class="dots">${dots}</div></button>`);
    }
    const sel = S.calDay && S.calDay.startsWith(S.calMonth) ? S.calDay : null;
    const shown = sel ? (byDay[sel] || []) : Object.keys(byDay).sort().flatMap((k) => byDay[k]);
    grid = `
      <div class="monthbar">
        <button class="roundbtn" data-act="month" data-v="-1">${ico('left')}</button>
        <strong>${MONTHS[m - 1]} <span class="muted">${y}</span></strong>
        <button class="roundbtn" data-act="month" data-v="1">${ico('right')}</button>
      </div>
      <div class="cal">
        <div class="dow">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cells">${cells.join('')}</div>
      </div>
      <h2 class="sec sm">${sel ? esc(fmtLong(sel)) : `En ${MONTHS[m - 1]}`}${sel ? ` <button class="link sm" data-act="day" data-v="">Ver todo el mes</button>` : ''}</h2>
      <div class="stack-s">${shown.length ? shown.map((c) => concertCard(c)).join('') : `<p class="muted pad-y">${sel ? 'Ningún concierto este día.' : 'Ningún concierto este mes con estos filtros.'}</p>`}</div>`;
  } else {
    const groups = {};
    for (const c of list) (groups[c.event_date.slice(0, 7)] ||= []).push(c);
    const keys = Object.keys(groups).sort();
    grid = keys.length
      ? keys.map((k) => { const [yy, mm] = k.split('-').map(Number); return `<h2 class="sec sm">${MONTHS[mm - 1]} <span class="muted">${yy}</span></h2><div class="stack-s">${groups[k].map((c) => concertCard(c)).join('')}</div>`; }).join('')
      : '<p class="muted pad-y">Ningún concierto con estos filtros.</p>';
  }

  return `
  <div class="screen">
    <header class="top row-between">
      <h1>Calendario</h1>
      <div class="seg">
        <button class="${S.calView === 'mes' ? 'on' : ''}" data-act="calview" data-v="mes">Mes</button>
        <button class="${S.calView === 'lista' ? 'on' : ''}" data-act="calview" data-v="lista">Lista</button>
      </div>
    </header>
    ${markChips()}
    <div class="pad">${filterSummary()}${grid}</div>
  </div>
  ${tabbar('calendario')}`;
}

function viewArtistas() {
  const all = myConcerts();
  const cards = S.follows.map((f) => {
    const n = all.filter((c) => c.artist_id === f.artist_id).length;
    const img = artistImg(f.artist_id);
    return `
    <a class="acard ${f.active ? '' : 'paused'}" href="#/artista/${f.artist_id}" style="--c:${artistColor(f.artist_id)}">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<div class="noimg-big">${esc(artistName(f.artist_id).slice(0, 1))}</div>`}
      <div class="acard-shade"></div>
      <div class="acard-txt">
        <strong>${esc(artistName(f.artist_id))}</strong>
        <span>${f.active ? (n ? `${n} concierto${n > 1 ? 's' : ''}` : 'Sin fechas') : 'En pausa'}</span>
      </div>
    </a>`;
  }).join('');

  return `
  <div class="screen">
    <header class="top row-between">
      <h1>Artistas</h1>
      <a class="roundbtn accent" href="#/nuevo">${ico('plus')}</a>
    </header>
    <div class="pad">
      ${S.follows.length ? `<div class="agrid">${cards}</div>` : `
        <div class="empty">${ico('mic', 'big')}<h3>Añade tu primer artista</h3>
        <p class="muted">Busca su nombre, elige la foto y las zonas donde quieres que busque.</p>
        <a class="btn primary" href="#/nuevo">${ico('plus')}Añadir artista</a></div>`}
    </div>
  </div>
  ${tabbar('artistas')}`;
}

function zonesEditor(zones, ctx) {
  return `
  <div class="zones">
    ${zones.map((z, i) => `<span class="zchip">${esc(zoneLabel(z))}<button data-act="zone-del" data-ctx="${ctx}" data-i="${i}" aria-label="Quitar">${ico('x')}</button></span>`).join('')}
    <button class="zchip add" data-act="zone-new" data-ctx="${ctx}">${ico('plus')}Añadir zona</button>
  </div>
  ${zones.length ? '' : '<p class="muted sm">Sin zonas: se buscará en todo el mundo.</p>'}`;
}

function viewNuevo() {
  const A = S.add ||= { q: '', results: null, loading: false, picked: null, zones: [{ t: 'country', v: 'ES' }], error: null };
  let step;
  if (!A.picked) {
    const res = A.results;
    step = `
      <form id="artist-search" class="searchrow">
        <input id="artist-q" name="q" placeholder="Nombre del artista o grupo" value="${esc(A.q)}" autocomplete="off" autofocus>
        <button class="roundbtn accent" type="submit">${ico('search')}</button>
      </form>
      ${A.loading ? '<p class="muted pad-y">Buscando…</p>' : ''}
      ${A.error ? `<p class="err pad-y">${esc(A.error)}</p>` : ''}
      ${res ? `
        <div class="pick">${res.map((r, i) => `
          <button class="pickcard" data-act="pick" data-i="${i}">
            <img src="${esc(r.thumb || r.image)}" alt="" loading="lazy">
            <strong class="ellipsis">${esc(r.name)}</strong>
            <span class="muted sm">${r.fans ? r.fans.toLocaleString('es-ES') + ' fans' : '&nbsp;'}</span>
          </button>`).join('')}
        </div>
        ${!res.length ? '<p class="muted pad-y">No lo encuentro en Deezer.</p>' : ''}
        ${A.q ? `<button class="btn ghost" data-act="pick-manual">Añadir «${esc(A.q)}» sin foto</button>` : ''}` : ''}
      <p class="muted sm pad-y">La foto se saca de Deezer. Luego puedes cambiarla por una tuya.</p>`;
  } else {
    const p = A.picked;
    step = `
      <div class="picked">
        ${p.image ? `<img src="${esc(p.image)}" alt="">` : `<div class="noimg-big">${esc(p.name.slice(0, 1))}</div>`}
        <div class="picked-shade"></div>
        <div class="picked-txt"><strong>${esc(p.name)}</strong><button class="link sm" data-act="unpick">Cambiar</button></div>
      </div>
      <h2 class="sec sm">¿Dónde busco sus conciertos?</h2>
      ${zonesEditor(A.zones, 'new')}
      <button class="btn primary full" data-act="save-artist">Seguir a ${esc(p.name)}</button>`;
  }
  return `
  <div class="screen">
    ${navBack('#/artistas', 'Artistas')}
    <header class="top tight"><h1>Nuevo artista</h1></header>
    <div class="pad stack">${step}</div>
  </div>`;
}

function viewArtista(id) {
  const f = followOf(id);
  const a = S.artists[id];
  if (!f || !a) return `<div class="screen">${navBack('#/artistas', 'Artistas')}<p class="pad muted">Este artista ya no está en tu lista.</p></div>`;
  const img = artistImg(id);
  const up = myConcerts().filter((c) => c.artist_id === id);
  const past = myConcerts({ includePast: true }).filter((c) => c.artist_id === id && c.event_date < todayIso() && S.marks[c.id] === 'voy');
  return `
  <div class="screen nopadtop">
    <div class="ahero" style="--c:${artistColor(id)}">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div class="noimg-big">${esc(a.name.slice(0, 1))}</div>`}
      <div class="ahero-shade"></div>
      <div class="nav over"><a href="#/artistas">${ico('back')}<span>Artistas</span></a>
        <button class="roundbtn glass" data-act="sheet" data-v="foto">${ico('camera')}</button></div>
      <div class="ahero-txt"><h1>${esc(a.name)}</h1>
        <span>${up.length ? `${up.length} concierto${up.length > 1 ? 's' : ''} en tus zonas` : 'Sin conciertos en tus zonas'}</span></div>
    </div>
    <div class="pad stack">
      <h2 class="sec sm">Zonas de búsqueda</h2>
      ${zonesEditor(f.zones, id)}
      <label class="switchrow">
        <span><strong>Buscar cada día</strong><br><span class="muted sm">${f.active ? 'Activo' : 'En pausa: no se busca ni se avisa'}</span></span>
        <input type="checkbox" class="switch" data-act="toggle-active" data-id="${id}" ${f.active ? 'checked' : ''}>
      </label>
      <h2 class="sec sm">Próximos conciertos</h2>
      ${up.length ? `<div class="stack-s">${up.map((c) => concertCard(c, { showArtist: false })).join('')}</div>` : '<p class="muted">Nada anunciado por ahora.</p>'}
      ${past.length ? `<h2 class="sec sm">Conciertos a los que fuiste</h2><div class="stack-s">${past.map((c) => concertCard(c, { showArtist: false })).join('')}</div>` : ''}
      <button class="btn danger" data-act="sheet" data-v="borrar">${ico('trash')}Dejar de seguir</button>
    </div>
  </div>`;
}

function viewConcierto(id) {
  const c = S.concerts.find((x) => x.id === id);
  if (!c) return `<div class="screen">${navBack('#/calendario', 'Calendario')}<p class="pad muted">Este concierto ya no existe.</p></div>`;
  const img = artistImg(c.artist_id);
  const mark = S.marks[c.id];
  const past = c.event_date < todayIso();
  const maps = `https://maps.apple.com/?q=${encodeURIComponent([c.venue, c.address, c.city, countryName(c.country)].filter(Boolean).join(', '))}`;
  const where = [c.city, c.country === 'ES' ? (c.province && norm(c.province) !== norm(c.city) ? c.province : '') : '', countryName(c.country)].filter(Boolean).join(', ');
  const row = (icon, main, sub = '', href = '') => {
    const inner = `${ico(icon)}<div class="grow"><div>${main}</div>${sub ? `<div class="muted sm">${sub}</div>` : ''}</div>${href ? ico('right', 'chev') : ''}`;
    return href ? `<a class="irow" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="irow">${inner}</div>`;
  };

  return `
  <div class="screen nopadtop">
    <div class="chero" style="--c:${artistColor(c.artist_id)}">
      ${img ? `<img src="${esc(img)}" alt="">` : ''}
      <div class="chero-shade"></div>
      <div class="nav over"><a href="javascript:history.back()">${ico('back')}<span>Atrás</span></a></div>
      <div class="chero-txt">
        <a class="artlink" href="#/artista/${c.artist_id}">${esc(artistName(c.artist_id))}</a>
        <h1 class="cdatebig">${esc(fmtShort(c.event_date))}${c.event_time ? ` <span>${fmtTime(c.event_time)}</span>` : ''}</h1>
        <div class="c-meta">${statusBadge(c)}${past ? '<span class="badge">Ya pasó</span>' : `<span class="badge glow">${countdown(c.event_date)}</span>`}</div>
      </div>
    </div>
    <div class="pad stack">
      ${c.title ? `<p class="ctitle">${esc(c.title)}</p>` : ''}
      <div class="marks">
        ${Object.entries(MARKS).map(([k, m]) => `<button class="mbtn ${mark === k ? 'on ' + k : ''}" data-act="mark" data-id="${c.id}" data-v="${k}">${ico(m.icon)}${m.label}</button>`).join('')}
      </div>
      <div class="info">
        ${row('clock', esc(fmtLong(c.event_date)), c.event_time ? `A las ${fmtTime(c.event_time)}` : 'Hora sin confirmar')}
        ${row('pin', esc(c.venue || 'Lugar sin confirmar'), esc([c.address, where].filter(Boolean).join(' · ')), c.venue || c.address ? maps : '')}
        ${c.price ? row('euro', esc(c.price)) : ''}
        ${c.tickets_url ? row('ticket', 'Comprar entradas', esc(domainOf(c.tickets_url)), c.tickets_url) : ''}
        ${c.tickets_info ? row('ticket', 'Entradas', esc(c.tickets_info)) : ''}
      </div>
      ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ''}
      <button class="btn ghost" data-act="ics" data-id="${c.id}">${ico('calplus')}Añadir al Calendario</button>
      <div class="info">
        ${row('link', 'Fuente: ' + esc(domainOf(c.source_url)), [c.source_date ? 'Publicado el ' + esc(fmtShort(c.source_date)) : '', 'Encontrado el ' + esc(fmtShort(c.first_seen.slice(0, 10)))].filter(Boolean).join(' · '), c.source_url)}
      </div>
      ${c.date_inferred ? '<p class="muted sm">La fuente no indicaba el año; se ha deducido por la fecha de publicación.</p>' : ''}
      ${mark !== 'descartado'
        ? `<button class="link center muted" data-act="mark" data-id="${c.id}" data-v="descartado">No me interesa (ocultar)</button>`
        : `<button class="link center" data-act="mark" data-id="${c.id}" data-v="descartado">Volver a mostrarlo</button>`}
    </div>
  </div>`;
}

function viewAjustes() {
  const last = S.runs[0];
  return `
  <div class="screen">
    <header class="top"><h1>Ajustes</h1></header>
    <div class="pad stack">
      <div class="group">
        <div class="grow-row"><div><strong>${esc(S.me?.name || '')}</strong><div class="muted sm">${esc(S.session?.user?.email || '')}</div></div></div>
      </div>
      <h2 class="sec sm">Búsqueda diaria</h2>
      <div class="group">
        <div class="grow-row"><span>Hora</span><span class="muted">Cada día, hacia las ${SEARCH_HOUR}</span></div>
        <div class="grow-row"><span>Última búsqueda</span><span class="muted">${last ? esc(fmtShort(last.ran_at.slice(0, 10))) + ' · ' + last.ran_at.slice(11, 16) : 'Todavía no se ha hecho'}</span></div>
        <div class="grow-row"><span>Artistas que sigues</span><span class="muted">${S.follows.filter((f) => f.active).length} activos</span></div>
      </div>
      <h2 class="sec sm">Avisos</h2>
      <div class="group"><div class="grow-row"><span class="muted sm" style="text-align:left">Los avisos al iPhone de conciertos nuevos y cambios llegarán en la siguiente fase.</span></div></div>
      <h2 class="sec sm">Contraseña</h2>
      <div class="group stack-s padin">
        <input id="pwd1" type="password" placeholder="Nueva contraseña" autocomplete="new-password">
        <input id="pwd2" type="password" placeholder="Repítela" autocomplete="new-password">
        <button class="btn ghost" data-act="pwd">Cambiar contraseña</button>
        <p class="muted sm">Es la misma que en Findes.</p>
      </div>
      <button class="btn danger" data-act="logout">Cerrar sesión</button>
      <p class="muted sm center">Conciertos ${APP_VERSION}</p>
    </div>
  </div>
  ${tabbar('ajustes')}`;
}

// ------------------------------------------------------------------ hojas inferiores

function sheetFiltros() {
  const base = myConcerts({ includePast: S.calView === 'mes' });
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const countries = uniq(base.map((c) => c.country)).sort((a, b) => countryName(a).localeCompare(countryName(b), 'es'));
  const provs = uniq(base.filter((c) => c.country === 'ES').map((c) => c.province)).sort((a, b) => a.localeCompare(b, 'es'));
  const cities = uniq(base.filter((c) => (!S.fCountry || c.country === S.fCountry) && (!S.fProvince || c.province === S.fProvince)).map((c) => c.city)).sort((a, b) => a.localeCompare(b, 'es'));
  const sel = (key, label, opts) => `
    <label class="fld"><span>${label}</span>
      <select data-filter="${key}"><option value="">Todos</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${S[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    </label>`;
  return `
    <h3>Filtrar</h3>
    ${sel('fArtist', 'Artista o grupo', S.follows.map((f) => [f.artist_id, artistName(f.artist_id)]))}
    ${sel('fCountry', 'País', countries.map((c) => [c, countryName(c)]))}
    ${(!S.fCountry || S.fCountry === 'ES') && provs.length ? sel('fProvince', 'Provincia', provs.map((p) => [p, p])) : ''}
    ${sel('fCity', 'Ciudad', cities.map((c) => [c, c]))}
    <div class="row2">
      <button class="btn ghost" data-act="fclear-all">Quitar filtros</button>
      <button class="btn primary" data-act="sheet-close">Ver resultados</button>
    </div>`;
}

function sheetZona() {
  const Z = S.zoneDraft ||= { t: 'country', v: 'ES', c: 'ES' };
  const types = [['world', 'Todo el mundo'], ['continent', 'Continente'], ['country', 'País'], ['region', 'Comunidad autónoma'], ['province', 'Provincia'], ['city', 'Ciudad']];
  let valueField = '';
  if (Z.t === 'continent') {
    valueField = `<label class="fld"><span>Continente</span><select data-zone="v">${Object.entries(CONTINENTS).map(([k, l]) => `<option value="${k}" ${Z.v === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  } else if (Z.t === 'country') {
    valueField = `<label class="fld"><span>País</span><select data-zone="v">${allCountries().map((c) => `<option value="${c.code}" ${Z.v === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
  } else if (Z.t === 'region') {
    valueField = `<label class="fld"><span>Comunidad (España)</span><select data-zone="v">${Object.entries(REGIONS_ES).sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([k, l]) => `<option value="${k}" ${Z.v === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  } else if (Z.t === 'province') {
    valueField = `<label class="fld"><span>Provincia (España)</span><select data-zone="v">${provincesOf().map((p) => `<option value="${esc(p)}" ${Z.v === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>`;
  } else if (Z.t === 'city') {
    valueField = `
      <label class="fld"><span>País</span><select data-zone="c">${allCountries().map((c) => `<option value="${c.code}" ${Z.c === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Ciudad</span><input data-zone="v" value="${esc(Z.v || '')}" placeholder="Ej. Salamanca"></label>`;
  }
  return `
    <h3>Añadir zona</h3>
    <div class="typegrid">${types.map(([k, l]) => `<button class="fchip ${Z.t === k ? 'on' : ''}" data-act="ztype" data-v="${k}">${l}</button>`).join('')}</div>
    ${valueField}
    <div class="row2">
      <button class="btn ghost" data-act="sheet-close">Cancelar</button>
      <button class="btn primary" data-act="zone-save">Añadir</button>
    </div>`;
}

function sheetFoto() {
  const P = S.photo ||= { results: null, loading: false };
  return `
    <h3>Cambiar foto</h3>
    <label class="btn ghost full">${ico('camera')}Subir una foto mía<input id="photo-file" type="file" accept="image/*" hidden></label>
    <button class="btn ghost full" data-act="photo-search">${ico('search')}Ver otras fotos de Deezer</button>
    ${P.loading ? '<p class="muted">Buscando…</p>' : ''}
    ${P.results ? `<div class="pick">${P.results.map((r, i) => `<button class="pickcard" data-act="photo-pick" data-i="${i}"><img src="${esc(r.thumb || r.image)}" alt=""><strong class="ellipsis">${esc(r.name)}</strong></button>`).join('')}</div>` : ''}
    ${followOf(route().id)?.image_url ? '<button class="link center" data-act="photo-reset">Volver a la foto por defecto</button>' : ''}
    <button class="btn ghost" data-act="sheet-close">Cerrar</button>`;
}

function sheetBorrar() {
  const id = route().id;
  return `
    <h3>¿Dejar de seguir a ${esc(artistName(id))}?</h3>
    <p class="muted">Dejarás de recibir sus conciertos y avisos. Tus marcas en sus conciertos se borran también.</p>
    <div class="row2">
      <button class="btn ghost" data-act="sheet-close">Cancelar</button>
      <button class="btn dangerfill" data-act="unfollow" data-id="${id}">Dejar de seguir</button>
    </div>`;
}

function sheetHtml() {
  if (!S.sheet) return '';
  const inner = { filtros: sheetFiltros, zona: sheetZona, foto: sheetFoto, borrar: sheetBorrar }[S.sheet]?.() || '';
  return `<div class="backdrop" data-act="sheet-close"></div><div class="sheet"><div class="grab"></div>${inner}</div>`;
}

// ------------------------------------------------------------------ render

function render() {
  const app = document.getElementById('app');
  if (!S.session) { app.innerHTML = viewLogin(); return; }
  if (S.error) { app.innerHTML = `<div class="screen"><div class="empty"><h3>No se pudo cargar</h3><p class="muted">${esc(S.error)}</p><button class="btn primary" data-act="retry">Reintentar</button><button class="link" data-act="logout">Cerrar sesión</button></div></div>`; return; }
  if (!S.loaded) { app.innerHTML = '<div class="loading"><div class="spot"></div></div>'; return; }
  const r = route();
  let html;
  switch (r.name) {
    case 'calendario': html = viewCalendario(); break;
    case 'artistas': html = viewArtistas(); break;
    case 'nuevo': html = viewNuevo(); break;
    case 'artista': html = viewArtista(r.id); break;
    case 'concierto': html = viewConcierto(r.id); break;
    case 'ajustes': html = viewAjustes(); break;
    default: html = viewInicio();
  }
  app.innerHTML = html + sheetHtml();
}

// Repintar sin perder el scroll
function softRender() {
  const y = window.scrollY;
  const sheetScroll = document.querySelector('.sheet')?.scrollTop || 0;
  render();
  window.scrollTo(0, y);
  const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = sheetScroll;
}

let toastTimer;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 2600);
}

// ------------------------------------------------------------------ acciones

async function doArtistSearch(q) {
  const A = S.add;
  A.q = q.trim(); A.error = null;
  if (!A.q) return;
  A.loading = true; A.results = null; softRender();
  try { A.results = await searchArtists(A.q, 9); } catch (e) { A.error = e.message; A.results = []; }
  A.loading = false; softRender();
}

async function saveArtist() {
  const A = S.add; const p = A.picked;
  const nn = norm(p.name);
  let artist = Object.values(S.artists).find((a) => a.name_norm === nn);
  if (!artist) {
    const r = await sb.from('conc_artists').insert({ name: p.name.trim(), name_norm: nn, deezer_id: p.id || null, image_url: p.image || null }).select().single();
    if (r.error) {
      const again = await sb.from('conc_artists').select('*').eq('name_norm', nn).maybeSingle();
      if (!again.data) { toast('Error: ' + r.error.message); return; }
      artist = again.data;
    } else artist = r.data;
  } else if (!artist.image_url && p.image) {
    await sb.from('conc_artists').update({ image_url: p.image, deezer_id: p.id }).eq('id', artist.id);
  }
  if (followOf(artist.id)) { toast('Ya sigues a este artista'); location.hash = `#/artista/${artist.id}`; return; }
  const r2 = await sb.from('conc_follows').insert({ artist_id: artist.id, zones: A.zones });
  if (r2.error) { toast('Error: ' + r2.error.message); return; }
  S.add = null;
  await loadAll();
  location.hash = `#/artista/${artist.id}`;
  toast(`Siguiendo a ${artist.name}`);
}

async function saveZones(artistId, zones) {
  const r = await sb.from('conc_follows').update({ zones }).eq('artist_id', artistId).eq('email', S.session.user.email.toLowerCase());
  if (r.error) { toast('Error: ' + r.error.message); return false; }
  followOf(artistId).zones = zones;
  return true;
}

async function setMark(id, v) {
  const cur = S.marks[id];
  if (cur === v) {
    const r = await sb.from('conc_marks').delete().eq('concert_id', id).eq('email', S.session.user.email.toLowerCase());
    if (r.error) { toast('Error: ' + r.error.message); return; }
    delete S.marks[id];
  } else {
    const r = await sb.from('conc_marks').upsert({ concert_id: id, mark: v });
    if (r.error) { toast('Error: ' + r.error.message); return; }
    S.marks[id] = v;
    if (v === 'voy') toast('¡A disfrutarlo! 🎟️');
    if (v === 'descartado') toast('Oculto. Lo puedes recuperar desde aquí.');
  }
  softRender();
}

function downloadIcs(c) {
  const dt = c.event_date.replace(/-/g, '');
  const escI = (s) => String(s || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  let start; let end;
  if (c.event_time) {
    const [h, m] = c.event_time.split(':').map(Number);
    start = `DTSTART:${dt}T${pad(h)}${pad(m)}00`;
    const e = new Date(2000, 0, 1, h + 2, m);
    end = `DTEND:${e.getDate() > 1 ? isoOf(new Date(parseIso(c.event_date).getTime() + 86400000)).replace(/-/g, '') : dt}T${pad(e.getHours())}${pad(e.getMinutes())}00`;
  } else {
    start = `DTSTART;VALUE=DATE:${dt}`;
    end = `DTEND;VALUE=DATE:${isoOf(new Date(parseIso(c.event_date).getTime() + 86400000)).replace(/-/g, '')}`;
  }
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Conciertos//ES', 'BEGIN:VEVENT',
    `UID:${c.id}@conciertos`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, start, end,
    `SUMMARY:${escI(artistName(c.artist_id) + (c.title ? ' · ' + c.title : ''))}`,
    `LOCATION:${escI([c.venue, c.address, c.city, countryName(c.country)].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escI([c.price && 'Precio: ' + c.price, c.tickets_info, c.tickets_url, c.source_url].filter(Boolean).join('\n'))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url; a.download = `concierto-${c.event_date}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function resizeImage(file, max = 900) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85));
}

async function uploadPhoto(file) {
  const id = route().id;
  toast('Subiendo foto…');
  try {
    const blob = await resizeImage(file);
    const path = `artistas/${S.me.person || 'yo'}-${id}-${Date.now()}.jpg`;
    const up = await sb.storage.from('conciertos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    const url = sb.storage.from('conciertos').getPublicUrl(path).data.publicUrl;
    await setFollowImage(id, url);
    toast('Foto cambiada');
  } catch (e) { toast('No se pudo subir: ' + (e.message || e)); }
}

async function setFollowImage(id, url) {
  const r = await sb.from('conc_follows').update({ image_url: url }).eq('artist_id', id).eq('email', S.session.user.email.toLowerCase());
  if (r.error) { toast('Error: ' + r.error.message); return; }
  followOf(id).image_url = url;
  S.sheet = null; S.photo = null; softRender();
}

async function changePassword() {
  const a = document.getElementById('pwd1').value;
  const b = document.getElementById('pwd2').value;
  if (a.length < 6) { toast('Mínimo 6 caracteres'); return; }
  if (a !== b) { toast('Las contraseñas no coinciden'); return; }
  const r = await sb.auth.updateUser({ password: a });
  if (r.error) { toast('Error: ' + r.error.message); return; }
  toast('Contraseña cambiada');
  softRender();
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act; const v = el.dataset.v;
  if (el.tagName === 'INPUT') return; // los interruptores van por "change"
  switch (act) {
    case 'fmark': S.fMark = v; softRender(); break;
    case 'fclear': S[v] = ''; if (v === 'fCountry') S.fProvince = ''; softRender(); break;
    case 'fclear-all': S.fCountry = S.fProvince = S.fCity = S.fArtist = ''; softRender(); break;
    case 'calview': S.calView = v; softRender(); break;
    case 'month': {
      const [y, m] = S.calMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(v), 1);
      S.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; S.calDay = null; softRender(); break;
    }
    case 'day': S.calDay = v && S.calDay !== v ? v : null; softRender(); break;
    case 'sheet': S.sheet = v; if (v === 'zona') S.zoneDraft = null; softRender(); break;
    case 'sheet-close': S.sheet = null; S.photo = null; softRender(); break;
    case 'pick': S.add.picked = S.add.results[Number(el.dataset.i)]; softRender(); window.scrollTo(0, 0); break;
    case 'pick-manual': S.add.picked = { id: null, name: S.add.q, image: null }; softRender(); break;
    case 'unpick': S.add.picked = null; softRender(); break;
    case 'zone-new': S.zoneCtx = el.dataset.ctx; S.zoneDraft = null; S.sheet = 'zona'; softRender(); break;
    case 'ztype': {
      const def = { world: {}, continent: { v: 'EU' }, country: { v: 'ES' }, region: { v: 'CL' }, province: { v: 'Salamanca' }, city: { c: 'ES', v: '' } }[v];
      S.zoneDraft = { t: v, ...def }; softRender(); break;
    }
    case 'zone-save': {
      const Z = { ...S.zoneDraft };
      if (Z.t === 'city' && !String(Z.v || '').trim()) { toast('Escribe la ciudad'); break; }
      if (Z.t === 'city') Z.v = Z.v.trim();
      if (Z.t !== 'city') delete Z.c;
      if (Z.t === 'world') delete Z.v;
      const ctx = S.zoneCtx;
      const cur = ctx === 'new' ? S.add.zones : followOf(ctx).zones;
      if (cur.some((z) => zoneKey(z) === zoneKey(Z))) { toast('Esa zona ya está'); break; }
      const next = Z.t === 'world' ? [Z] : [...cur.filter((z) => z.t !== 'world'), Z];
      if (ctx === 'new') S.add.zones = next; else if (!(await saveZones(ctx, next))) break;
      S.sheet = null; softRender(); break;
    }
    case 'zone-del': {
      const ctx = el.dataset.ctx; const i = Number(el.dataset.i);
      if (ctx === 'new') { S.add.zones.splice(i, 1); softRender(); break; }
      const next = followOf(ctx).zones.filter((_, k) => k !== i);
      if (await saveZones(ctx, next)) softRender();
      break;
    }
    case 'save-artist': el.disabled = true; await saveArtist(); break;
    case 'unfollow': {
      const id = el.dataset.id;
      const ids = S.concerts.filter((c) => c.artist_id === id).map((c) => c.id);
      if (ids.length) await sb.from('conc_marks').delete().in('concert_id', ids).eq('email', S.session.user.email.toLowerCase());
      const r = await sb.from('conc_follows').delete().eq('artist_id', id).eq('email', S.session.user.email.toLowerCase());
      if (r.error) { toast('Error: ' + r.error.message); break; }
      S.sheet = null; await loadAll(); location.hash = '#/artistas'; toast('Has dejado de seguirlo'); break;
    }
    case 'photo-search': {
      S.photo = { results: null, loading: true }; softRender();
      try { S.photo.results = await searchArtists(artistName(route().id), 9); } catch (e) { toast(e.message); S.photo.results = []; }
      S.photo.loading = false; softRender(); break;
    }
    case 'photo-pick': await setFollowImage(route().id, S.photo.results[Number(el.dataset.i)].image); toast('Foto cambiada'); break;
    case 'photo-reset': await setFollowImage(route().id, null); break;
    case 'mark': await setMark(el.dataset.id, v); break;
    case 'ics': downloadIcs(S.concerts.find((c) => c.id === el.dataset.id)); break;
    case 'pwd': await changePassword(); break;
    case 'logout': await sb.auth.signOut(); break;
    case 'retry': S.error = null; boot(); break;
    default: break;
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.filter) {
    S[el.dataset.filter] = el.value;
    if (el.dataset.filter === 'fCountry') { S.fProvince = ''; S.fCity = ''; }
    if (el.dataset.filter === 'fProvince') S.fCity = '';
    softRender();
  } else if (el.dataset.zone) {
    S.zoneDraft[el.dataset.zone] = el.value;
  } else if (el.dataset.act === 'toggle-active') {
    const id = el.dataset.id;
    const r = await sb.from('conc_follows').update({ active: el.checked }).eq('artist_id', id).eq('email', S.session.user.email.toLowerCase());
    if (r.error) { toast('Error: ' + r.error.message); el.checked = !el.checked; return; }
    followOf(id).active = el.checked; softRender();
  } else if (el.id === 'photo-file' && el.files[0]) {
    await uploadPhoto(el.files[0]);
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.dataset.zone) S.zoneDraft[ev.target.dataset.zone] = ev.target.value;
});

document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (ev.target.id === 'artist-search') {
    document.getElementById('artist-q')?.blur();
    await doArtistSearch(new FormData(ev.target).get('q'));
    return;
  }
  if (ev.target.id !== 'login-form') return;
  const f = new FormData(ev.target);
  const errEl = document.getElementById('login-error');
  const btn = ev.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({
    email: String(f.get('email')).trim().toLowerCase(), password: String(f.get('password')),
  });
  if (error) {
    btn.disabled = false; btn.textContent = 'Entrar';
    errEl.textContent = error.message.includes('Invalid') ? 'Email o contraseña incorrectos' : error.message;
  }
});

window.addEventListener('hashchange', () => {
  const r = route();
  if (r.name !== 'nuevo') S.add = null;
  S.sheet = null; S.photo = null;
  render();
  window.scrollTo(0, 0);
});

// ------------------------------------------------------------------ arranque

function markSeen() {
  try { localStorage.setItem('conciertos-visto', new Date().toISOString()); } catch (_) { /* nada */ }
}

async function boot() {
  render();
  if (!S.session) return;
  try { await loadAll(); } catch (e) { S.error = e.message || String(e); }
  render();
  markSeen(); // lo nuevo se sigue marcando como "Nuevo" hasta la siguiente visita
}

sb.auth.onAuthStateChange((event, session) => {
  const had = !!S.session;
  S.session = session;
  if (!session) { S.loaded = false; S.me = null; render(); } else if (!had) boot();
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.session && S.loaded) {
    try { await loadAll(); softRender(); markSeen(); } catch (_) { /* nada */ }
  }
});

render();
