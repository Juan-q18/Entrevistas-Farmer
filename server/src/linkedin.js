const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
    jobs.push({
      linkedinId: id,
      title,
      company,
      location,
      url: `https://www.linkedin.com/jobs/view/${id}`,
      postedDate: date
    });
  }
  return jobs;
}

export async function fetchLinkedInJobs(search) {
  const url = buildSearchUrl(search);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: controller.signal
    });
    if (res.status === 999 || res.status === 429) {
      throw new Error('LinkedIn bloqueó la búsqueda (puede ser temporal). Esperá unos minutos y volvé a intentar.');
    }
    if (!res.ok) throw new Error(`LinkedIn respondió HTTP ${res.status}`);
    const html = await res.text();
    if (html.includes('captcha') || html.includes('securescripts') || html.length < 500) {
      throw new Error('LinkedIn pidió verificación de seguridad. Probá de nuevo más tarde o cambiá los filtros.');
    }
    return parseJobCards(html);
  } finally {
    clearTimeout(timer);
  }
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const res = await fetch(`https://www.linkedin.com/jobs/view/${linkedinId}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: controller.signal
    });
    if (res.status === 999 || res.status === 429) {
      throw new Error('LinkedIn bloqueó el pedido (puede ser temporal). Esperá unos minutos y volvé a intentar.');
    }
    if (res.status === 404) throw new Error('Este puesto ya no existe en LinkedIn (fue removido o expiró).');
    if (!res.ok) throw new Error(`LinkedIn respondió HTTP ${res.status}`);
    const html = await res.text();
    if (res.url.includes('/authwall') || html.slice(0, 20000).includes('authwall')) {
      throw new Error('LinkedIn pide login para ver este puesto.');
    }
    const block =
      html.match(/class="show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/) ??
      html.match(/description__text[^>]*>([\s\S]*?)<\/div>/);
    if (!block) throw new Error('No se pudo extraer la descripción de este puesto.');
    const text = htmlToText(block[1]);
    if (text.length < 30) throw new Error('No se pudo extraer la descripción de este puesto.');
    return text;
  } finally {
    clearTimeout(timer);
  }
}