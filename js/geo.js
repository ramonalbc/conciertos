// Datos geográficos para las zonas de búsqueda y los filtros.
// Los nombres de países salen del propio iPhone (Intl.DisplayNames), en castellano.

export const CONTINENTS = {
  EU: 'Europa',
  NA: 'Norteamérica y Centroamérica',
  SA: 'Sudamérica',
  AS: 'Asia',
  AF: 'África',
  OC: 'Oceanía',
};

const BY_CONTINENT = {
  EU: 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GI GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK',
  NA: 'AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA PR SV TT US VC',
  SA: 'AR BO BR CL CO EC GY PE PY SR UY VE',
  AS: 'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE',
  AF: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW',
  OC: 'AU FJ NZ PG SB VU WS TO',
};

export const COUNTRY_CONTINENT = {};
for (const [c, list] of Object.entries(BY_CONTINENT)) for (const k of list.split(' ')) COUNTRY_CONTINENT[k] = c;

let regionNames = null;
try { regionNames = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (_) { regionNames = null; }
const COUNTRY_FIX = { XK: 'Kosovo', GB: 'Reino Unido', US: 'Estados Unidos' };

export function countryName(code) {
  if (!code) return '';
  if (COUNTRY_FIX[code]) return COUNTRY_FIX[code];
  try { return (regionNames && regionNames.of(code)) || code; } catch (_) { return code; }
}

export function countriesOf(continent) {
  return (BY_CONTINENT[continent] || '').split(' ').filter(Boolean)
    .map((c) => ({ code: c, name: countryName(c) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function allCountries() {
  return Object.keys(COUNTRY_CONTINENT)
    .map((c) => ({ code: c, name: countryName(c) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// Comunidades autónomas (código → nombre)
export const REGIONS_ES = {
  AN: 'Andalucía', AR: 'Aragón', AS: 'Asturias', IB: 'Illes Balears', CN: 'Canarias',
  CB: 'Cantabria', CL: 'Castilla y León', CM: 'Castilla-La Mancha', CT: 'Cataluña',
  EX: 'Extremadura', GA: 'Galicia', MD: 'Comunidad de Madrid', MC: 'Región de Murcia',
  NC: 'Navarra', PV: 'País Vasco', RI: 'La Rioja', VC: 'Comunitat Valenciana',
  CE: 'Ceuta', ML: 'Melilla',
};

// Provincias (nombre → comunidad)
export const PROVINCES_ES = {
  'Almería': 'AN', 'Cádiz': 'AN', 'Córdoba': 'AN', 'Granada': 'AN', 'Huelva': 'AN', 'Jaén': 'AN', 'Málaga': 'AN', 'Sevilla': 'AN',
  'Huesca': 'AR', 'Teruel': 'AR', 'Zaragoza': 'AR',
  'Asturias': 'AS',
  'Illes Balears': 'IB',
  'Las Palmas': 'CN', 'Santa Cruz de Tenerife': 'CN',
  'Cantabria': 'CB',
  'Ávila': 'CL', 'Burgos': 'CL', 'León': 'CL', 'Palencia': 'CL', 'Salamanca': 'CL', 'Segovia': 'CL', 'Soria': 'CL', 'Valladolid': 'CL', 'Zamora': 'CL',
  'Albacete': 'CM', 'Ciudad Real': 'CM', 'Cuenca': 'CM', 'Guadalajara': 'CM', 'Toledo': 'CM',
  'Barcelona': 'CT', 'Girona': 'CT', 'Lleida': 'CT', 'Tarragona': 'CT',
  'Badajoz': 'EX', 'Cáceres': 'EX',
  'A Coruña': 'GA', 'Lugo': 'GA', 'Ourense': 'GA', 'Pontevedra': 'GA',
  'Madrid': 'MD',
  'Murcia': 'MC',
  'Navarra': 'NC',
  'Álava': 'PV', 'Bizkaia': 'PV', 'Gipuzkoa': 'PV',
  'La Rioja': 'RI',
  'Alicante': 'VC', 'Castellón': 'VC', 'Valencia': 'VC',
  'Ceuta': 'CE', 'Melilla': 'ML',
};

export function provincesOf(region) {
  return Object.entries(PROVINCES_ES).filter(([, r]) => !region || r === region).map(([p]) => p)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ¿Cae un concierto dentro de alguna de las zonas?
export function inZone(c, zones) {
  if (!zones || !zones.length) return true;
  return zones.some((z) => {
    switch (z.t) {
      case 'world': return true;
      case 'continent': return COUNTRY_CONTINENT[c.country] === z.v;
      case 'country': return c.country === z.v;
      case 'region': return c.country === 'ES' && (c.region === z.v || PROVINCES_ES[c.province] === z.v);
      case 'province': return c.country === 'ES' && norm(c.province) === norm(z.v);
      case 'city': return (!z.c || c.country === z.c) && norm(c.city) === norm(z.v);
      default: return false;
    }
  });
}

export function zoneLabel(z) {
  switch (z.t) {
    case 'world': return 'Todo el mundo';
    case 'continent': return CONTINENTS[z.v] || z.v;
    case 'country': return countryName(z.v);
    case 'region': return REGIONS_ES[z.v] || z.v;
    case 'province': return `Prov. ${z.v}`;
    case 'city': return z.c && z.c !== 'ES' ? `${z.v} (${countryName(z.c)})` : z.v;
    default: return '?';
  }
}

export const zoneKey = (z) => `${z.t}:${z.c || ''}:${z.v || ''}`;
