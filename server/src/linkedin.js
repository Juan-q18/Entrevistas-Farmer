const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
];
const getUA = (seed) => UA_POOL[seed % UA_POOL.length];

// f_WT nativo de LinkedIn: 1=Presencial, 2=Remoto, 3=Híbrido
export const WORK_TYPE_VALUES = {
  on_site: '1',
  remote: '2',
  hybrid: '3'
};

export const COUNTRIES = [
  { code: 'AR', name: 'Argentina', geoId: '100519571', names: ['argentina'] },
  { code: 'ES', name: 'España', geoId: '105646813', names: ['españa', 'spain'] },
  { code: 'MX', name: 'México', geoId: '103957667', names: ['méxico', 'mexico'] },
  { code: 'BR', name: 'Brasil', geoId: '106057199', names: ['brasil', 'brazil'] },
  { code: 'CL', name: 'Chile', geoId: '100365931', names: ['chile'] },
  { code: 'UY', name: 'Uruguay', geoId: '104077954', names: ['uruguay'] },
  { code: 'CO', name: 'Colombia', geoId: '100604021', names: ['colombia'] },
  { code: 'PE', name: 'Perú', geoId: '101404507', names: ['perú', 'peru'] },
  { code: 'US', name: 'Estados Unidos', geoId: '103644278', names: ['estados unidos', 'united states', 'ee. uu.', 'eeuu', 'usa'] },
  { code: 'CA', name: 'Canadá', geoId: '101174742', names: ['canadá', 'canada'] },
  { code: 'GB', name: 'Reino Unido', geoId: '101165590', names: ['reino unido', 'united kingdom', 'uk', 'england'] },
  { code: 'DE', name: 'Alemania', geoId: '101282230', names: ['alemania', 'germany'] },
  { code: 'FR', name: 'Francia', geoId: '105015875', names: ['francia', 'france'] },
  { code: 'PT', name: 'Portugal', geoId: '103890388', names: ['portugal'] },
  { code: 'NL', name: 'Países Bajos', geoId: '102890883', names: ['países bajos', 'netherlands', 'holanda'] },
  { code: 'IE', name: 'Irlanda', geoId: '105607864', names: ['irlanda', 'ireland'] },
  { code: 'IT', name: 'Italia', geoId: '103350119', names: ['italia', 'italy'] },
  { code: 'IN', name: 'India', geoId: '102713980', names: ['india'] },
  { code: 'SG', name: 'Singapur', geoId: '106693599', names: ['singapur', 'singapore'] }
];

export const CONTINENTS = [
  { name: 'Europa', countries: ['ES', 'GB', 'DE', 'FR', 'PT', 'NL', 'IE', 'IT'] },
  { name: 'Norteamérica', countries: ['US', 'CA', 'MX'] },
  { name: 'Sudamérica', countries: ['AR', 'BR', 'CL', 'UY', 'CO', 'PE'] },
  { name: 'Asia', countries: ['IN', 'SG'] }
];

const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

// ciudades conocidas → país (para locations que solo traen la ciudad)
const CITY_COUNTRY = {
  'madrid': 'España', 'barcelona': 'España', 'valencia': 'España', 'sevilla': 'España',
  'bilbao': 'España', 'zaragoza': 'España', 'málaga': 'España', 'malaga': 'España',
  'granada': 'España', 'palma': 'España', 'alicante': 'España', 'tres cantos': 'España',
  'buenos aires': 'Argentina', 'córdoba': 'Argentina', 'rosario': 'Argentina',
  'mendoza': 'Argentina', 'la plata': 'Argentina',
  'méxico': 'México', 'mexico city': 'México', 'guadalajara': 'México', 'monterrey': 'México',
  'são paulo': 'Brasil', 'sao paulo': 'Brasil', 'río de janeiro': 'Brasil', 'rio de janeiro': 'Brasil',
  'santiago': 'Chile', 'montevideo': 'Uruguay', 'bogotá': 'Colombia', 'bogota': 'Colombia',
  'medellín': 'Colombia', 'medellin': 'Colombia', 'lima': 'Perú',
  'nueva york': 'Estados Unidos', 'new york': 'Estados Unidos', 'miami': 'Estados Unidos',
  'los ángeles': 'Estados Unidos', 'los angeles': 'Estados Unidos', 'chicago': 'Estados Unidos',
  'houston': 'Estados Unidos', 'austin': 'Estados Unidos', 'seattle': 'Estados Unidos',
  'toronto': 'Canadá', 'vancouver': 'Canadá', 'montreal': 'Canadá',
  'londres': 'Reino Unido', 'london': 'Reino Unido', 'manchester': 'Reino Unido',
  'birmingham': 'Reino Unido', 'edimburgo': 'Reino Unido', 'edinburgh': 'Reino Unido',
  'belfast': 'Reino Unido', 'cardiff': 'Reino Unido', 'bristol': 'Reino Unido',
  'berlín': 'Alemania', 'berlin': 'Alemania', 'múnich': 'Alemania', 'munich': 'Alemania',
  'hamburgo': 'Alemania', 'hamburg': 'Alemania', 'frankfurt': 'Alemania',
  'parís': 'Francia', 'paris': 'Francia', 'lyon': 'Francia', 'burdeos': 'Francia',
  'lisboa': 'Portugal', 'oporto': 'Portugal', 'porto': 'Portugal',
  'amsterdam': 'Países Bajos', 'rotterdam': 'Países Bajos',
  'dublín': 'Irlanda', 'dublin': 'Irlanda', 'roma': 'Italia', 'rome': 'Italia',
  'milán': 'Italia', 'milan': 'Italia', 'nueva delhi': 'India', 'new delhi': 'India',
  'bombay': 'India', 'mumbai': 'India', 'bangalore': 'India', 'singapur': 'Singapur'
};

// expande selección de países/continentes a lista de países con geoId
export function expandCountries(selected = []) {
  const codes = new Set();
  for (const s of selected) {
    const continent = CONTINENTS.find((c) => c.name === s);
    if (continent) continent.countries.forEach((code) => codes.add(code));
    else if (COUNTRY_BY_CODE[s]) codes.add(s);
  }
  return [...codes].map((code) => COUNTRY_BY_CODE[code]).filter(Boolean);
}

// work type automático por país: Argentina → híbrido, resto → remoto
export function workTypeForCountry(code) {
  return code === 'AR' ? WORK_TYPE_VALUES.hybrid : WORK_TYPE_VALUES.remote;
}

export function buildSearchUrl(search) {
  const p = new URLSearchParams();
  if (search.keywords) p.set('keywords', search.keywords);
  if (search.location) p.set('location', search.location);
  if (search.geoId) p.set('geoId', search.geoId);
  if (search.timePosted) p.set('f_TPR', search.timePosted);
  if (search.jobTypes?.length) p.set('f_JT', search.jobTypes.join(','));
  if (search.workTypes?.length) p.set('f_WT', search.workTypes.join(','));
  if (search.experienceLevels?.length) p.set('f_E', search.experienceLevels.join(','));
  if (search.companyId) p.set('f_C', search.companyId);
  p.set('start', '0');
  p.set('count', '25');
  p.set('sortBy', 'DD');
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${p.toString()}`;
}

function clean(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REMOTE_RE = /\b(remote|remoto|100\s*%\s*remote|fully\s*remote|work\s*from\s*anywhere|work\s*from\s*home|wfh|teletrabajo|home\s*office|remote[- ]first)\b/i;
const ONSITE_RE = /\b(on.?site|presencial|in\s*office|office\s*based)\b/i;

// detecta país y remoto a partir de la location y el título
function enrichLocation(location, title = '') {
  const loc = (location || '').toLowerCase();
  const haystack = `${title ?? ''} ${location ?? ''}`;
  const remote = REMOTE_RE.test(haystack) ? 1 : 0;
  const onsite = ONSITE_RE.test(haystack) && !REMOTE_RE.test(haystack) ? 1 : 0;
  let country = '';
  for (const c of COUNTRIES) {
    if (c.names.some((n) => loc.includes(n))) {
      country = c.name;
      break;
    }
  }
  if (!country) {
    // ciudad conocida → país
    for (const [city, name] of Object.entries(CITY_COUNTRY)) {
      if (loc.includes(city)) {
        country = name;
        break;
      }
    }
  }
  if (!country) {
    // último segmento tras la última coma (ej: "Buenos Aires, Argentina" → "Argentina")
    const last = String(location ?? '').split(',').pop()?.trim();
    if (last && !REMOTE_RE.test(last)) country = last;
  }
  return { remote, onsite, country };
}

export function parseJobCards(html) {
  const cards = html.split(/<div class="base-card /g).slice(1);
  const jobs = [];
  for (const card of cards) {
    const id = card.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/)?.[1];
    if (!id) continue;
    const title = clean(card.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/)?.[1]);
    const company = clean(card.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/)?.[1]);
    const location = clean(card.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const date = clean(card.match(/job-search-card__listdate[^>]*>([\s\S]*?)<\/time>/)?.[1]);
    if (!title) continue;
    const { remote, onsite, country } = enrichLocation(location, title);
    jobs.push({
      linkedinId: id,
      title,
      company,
      location,
      url: `https://www.linkedin.com/jobs/view/${id}`,
      postedDate: date,
      remote,
      onsite,
      country
    });
  }
  return jobs;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class LinkedInBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LinkedInBlockedError';
  }
}

async function fetchHtml(url, { label = 'búsqueda' } = {}) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': getUA(attempt),
          Accept: '*/*',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'sec-ch-ua': '"Chromium";v="126", "Not:A-Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        },
        signal: controller.signal
      });
      if (res.status === 999 || res.status === 429) {
        if (attempt < maxAttempts) {
          await sleep(8000 * attempt);
          continue;
        }
        throw new LinkedInBlockedError(`LinkedIn bloqueó la ${label} (puede ser temporal). Esperá unos minutos y volvé a intentar.`);
      }
      if (res.status === 404) throw new Error('Este puesto ya no existe en LinkedIn (fue removido o expiró).');
      if (!res.ok) throw new Error(`LinkedIn respondió HTTP ${res.status}`);
      const html = await res.text();
      if (html.includes('captcha') || html.includes('securescripts')) {
        if (attempt < maxAttempts) {
          await sleep(10000 * attempt);
          continue;
        }
        throw new LinkedInBlockedError(`LinkedIn pidió verificación de seguridad en la ${label}. Probá de nuevo en unos minutos o reducí la cantidad de países/filtros.`);
      }
      return html;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`No se pudo completar la ${label} de LinkedIn`);
}

export async function fetchLinkedInJobs(search) {
  const url = buildSearchUrl(search);
  const html = await fetchHtml(url, { label: 'búsqueda' });
  return parseJobCards(html);
}

function htmlToText(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|ul|ol|h[1-6]|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fetchJobDescription(linkedinId) {
  const html = await fetchHtml(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${linkedinId}`, { label: 'descripción' });
  if (html.slice(0, 20000).includes('authwall')) {
    throw new Error('LinkedIn pide login para ver este puesto.');
  }
  const block =
    html.match(/class="show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/) ??
    html.match(/description__text[^>]*>([\s\S]*?)<\/div>/);
  if (!block) throw new Error('No se pudo extraer la descripción de este puesto.');
  const text = htmlToText(block[1]);
  if (text.length < 30) throw new Error('No se pudo extraer la descripción de este puesto.');
  return text;
}