import db from './db.js';

export const AI_PROVIDERS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'deepseek/deepseek-chat' },
  ollama: { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1', noKey: true }
};

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const provider = s.ai_provider ?? 'deepseek';
  return {
    provider,
    model: s.ai_model || AI_PROVIDERS[provider]?.defaultModel || 'deepseek-chat',
    apiKey: s.ai_api_key ?? '',
    baseUrl: s.ai_base_url || ''
  };
}

export function getMaskedSettings() {
  const s = getSettings();
  return {
    provider: s.provider,
    model: s.model,
    baseUrl: s.baseUrl,
    hasKey: s.apiKey.length > 0,
    keyPreview: s.apiKey.length > 4 ? '••••' + s.apiKey.slice(-4) : '',
    providers: Object.fromEntries(
      Object.entries(AI_PROVIDERS).map(([k, v]) => [k, { label: v.label, baseUrl: v.baseUrl, defaultModel: v.defaultModel, noKey: !!v.noKey }])
    )
  };
}

export function saveSettings({ provider, model, apiKey, baseUrl }) {
  if (provider) db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(provider), 'ai_provider');
  if (model) db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(model), 'ai_model');
  if (typeof apiKey === 'string' && apiKey.trim()) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(apiKey.trim(), 'ai_api_key');
  }
  if (typeof baseUrl === 'string') {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(baseUrl.trim(), 'ai_base_url');
  }
}

async function chatComplete(settings, system, user, { maxTokens = 700, temperature = 0.6 } = {}) {
  const baseUrl = (settings.baseUrl || AI_PROVIDERS[settings.provider]?.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Falta la URL base del proveedor de IA');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: maxTokens,
        temperature
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) throw new Error('API key inválida (el proveedor la rechazó)');
      if (res.status === 404) throw new Error('Modelo no encontrado: verificá el nombre en Configuración');
      throw new Error(`Error del proveedor IA (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('El proveedor IA no devolvió texto');
    return content.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  } finally {
    clearTimeout(timer);
  }
}

export async function improveText(field, value) {
  if (!value || String(value).trim().length < 10) {
    throw new Error('El texto es demasiado corto para mejorar');
  }
  const settings = getSettings();
  if (!settings.apiKey && !AI_PROVIDERS[settings.provider]?.noKey) {
    throw new Error('No hay API key configurada: andá a Configuración y guardala');
  }
  const system = `Sos un editor de CVs experto. Reescribís textos de CV en español con tono profesional y atractivo para reclutadores de RRHH.

REGLAS ESTRICTAS:
- NO inventes datos: mantené exactamente los hechos, cifras, tecnologías, nombres y fechas del texto original.
- No agregues logros, métricas ni responsabilidades que no estén en el original.
- Usá verbos de acción, mejorá la redacción y el flujo, eliminá repeticiones y palabras débiles.
- Mantené una longitud similar a la original (más o menos 20%).
- Devolvé ÚNICAMENTE el texto reescrito, sin comillas, sin prefijos ni explicaciones.`;
  const user = field === 'resumen'
    ? `Texto original (resumen de CV):\n"""${value}"""\nReescribilo mejorado.`
    : `Texto original (descripción de experiencia laboral):\n"""${value}"""\nReescribilo mejorado, conservando el sentido y todos los datos.`;
  return chatComplete(settings, system, user);
}

export async function testConnection() {
  const settings = getSettings();
  if (!settings.apiKey && !AI_PROVIDERS[settings.provider]?.noKey) {
    throw new Error('No hay API key configurada');
  }
  const out = await chatComplete(settings, 'Respondé únicamente con la palabra OK.', 'Test de conexión.', { maxTokens: 10, temperature: 0 });
  if (!/ok/i.test(out)) throw new Error('Respuesta inesperada: ' + out.slice(0, 80));
  return true;
}

// ─── Language Detection (heuristic, no API calls) ──────────────────────────

const ES_WORDS = new Set([
  'el','la','los','las','de','del','un','una','unos','unas',
  'es','son','era','fue','ser','estar','está','están',
  'en','con','por','para','que','se','no','más',
  'este','esta','estos','estas','ese','esa','esos','esas',
  'como','sin','entre','sobre','hasta','desde','otro','otra',
  'muy','bien','también','pero','aunque','cuando','donde',
  'hacer','tener','poder','decir','dar','saber','querer',
  'desarrollo','gestión','experiencia','proyecto','equipo','empresa',
  'servicio','cliente','sistema','proceso','área','nivel','cargo',
  'funciones','responsabilidades','logros','habilidades','formación',
  'actualmente','anterior','mediante','durante','primer','primera',
  'necesario','importante','principal','diferentes',
  'desarrollar','implementar','gestionar','coordinar','supervisar',
  'participar','colaborar','contribuir','optimizar','mejorar',
  'diseñar','configurar','administrar','analizar','evaluar',
  'capacitación','certificación','diplomado','posgrado',
  'recibir','analizar','ejecutar','investigar','asegurar',
  'documentar','realizar','informar','reportar','resolver',
  'proporcionar','solucionar','mejorando','creando','modificando',
]);
const EN_WORDS = new Set([
  'the','is','are','was','were','has','have','had',
  'and','with','for','in','to','of','this','that',
  'these','those','a','an','it','they','we','you',
  'can','will','should','would','could','may','must',
  'do','does','did','been','being','at','by',
  'from','on','as','if','or','but','not','so',
  'than','too','very','just','also','only','even',
  'more','most','other','some','such','no','own','same',
  'into','over','after','before','between','under',
  'about','against','through','during','above','below',
  'then','once','here','there','each','every','all',
  'both','few','many','much','any','either',
  'because','while','although','since','until',
  'development','management','experience','project','team','company',
  'service','client','system','process','area','level','position',
  'functions','responsibilities','achievements','skills','education',
  'required','important','main','different','multiple',
  'develop','implement','manage','coordinate','supervise',
  'participate','collaborate','contribute','optimize','improve',
  'design','configure','administer','analyze','evaluate',
  'receive','analyze','execute','investigate','ensure',
  'document','perform','report','resolve','provide',
  'solving','testing','automation','regression','analysis',
  'receive','specific','previously','currently',
]);

export function detectLang(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  const clean = text.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, ' ').trim();
  if (clean.length < 3) return 'unknown';
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return 'unknown';
  const hasAccents = /[ñáéíóúü]/i.test(text);
  let esHits = 0, enHits = 0;
  for (const w of words) {
    if (ES_WORDS.has(w)) esHits++;
    if (EN_WORDS.has(w)) enHits++;
  }
  if (hasAccents && esHits >= 1) return 'es';
  if (esHits >= 2 && esHits > enHits) return 'es';
  if (enHits >= 2 && enHits > esHits) return 'en';
  if (esHits >= 1 && enHits === 0) return 'es';
  if (enHits >= 1 && esHits === 0) return 'en';
  return 'unknown';
}

function needsTranslation(text, targetLang) {
  if (!text || typeof text !== 'string' || text.trim().length < 3) return false;
  return detectLang(text) !== targetLang;
}

export async function translateCv(cv, targetLang = 'en') {
  const settings = getSettings();
  if (!settings.apiKey && !AI_PROVIDERS[settings.provider]?.noKey) {
    throw new Error('No hay API key configurada: andá a Configuración y guardala');
  }

  const from = targetLang === 'es' ? 'English' : 'Spanish';
  const to = targetLang === 'es' ? 'Spanish' : 'English';

  const translate = async (text) => {
    if (!text || text.trim().length < 3) return text;
    const raw = await chatComplete(settings,
      `You are a professional CV translator. Translate the following ${from} text to ${to}.
Rules:
- Keep technology/tool names unchanged (Postman, SQL, Playwright, Selenium, Azure, etc.)
- Keep company names and proper nouns unchanged
- Use professional CV language
- Output ONLY the ${to} translation, nothing else.`,
      text,
      { maxTokens: 400, temperature: 0.3 }
    );
    return raw.replace(/^["'"''']+|["'"''']+$/g, '').trim() || text;
  };

  const translateList = async (items) => {
    if (!items?.length) return items;
    const numbered = items.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const raw = await chatComplete(settings,
      `You are a professional CV translator. Translate each numbered item from ${from} to ${to}.
Rules:
- Keep technology/tool names unchanged (SQL, MySQL, Postman, Playwright, etc.)
- Keep company names unchanged
- Use professional CV language
- Output ONLY the numbered translations in the same format, nothing else.`,
      numbered,
      { maxTokens: 800, temperature: 0.3 }
    );
    const lines = raw.split('\n').filter((l) => /^\d+\./.test(l.trim()));
    return items.map((orig, i) => {
      const match = lines[i]?.replace(/^\d+\.\s*/, '').trim();
      return match || orig;
    });
  };

  const sel = async (text) => {
    if (!needsTranslation(text, targetLang)) return text;
    return translate(text);
  };

  const selList = async (items) => {
    if (!items?.length) return items;
    const indices = items.map((t, i) => ({ t, i })).filter(({ t }) => needsTranslation(t, targetLang));
    if (!indices.length) return items;
    const texts = indices.map(({ t }) => t);
    const translated = await translateList(texts);
    const result = [...items];
    indices.forEach(({ i }, j) => { result[i] = translated[j]; });
    return result;
  };

  const LANG_NAMES = {
    'english':    { es: 'Inglés',    en: 'English' },
    'español':    { es: 'Español',   en: 'Spanish' },
    'spanish':    { es: 'Español',   en: 'Spanish' },
    'portuguese': { es: 'Portugués', en: 'Portuguese' },
    'portugués':  { es: 'Portugués', en: 'Portuguese' },
    'french':     { es: 'Francés',   en: 'French' },
    'francés':    { es: 'Francés',   en: 'French' },
    'german':     { es: 'Alemán',    en: 'German' },
    'alemán':     { es: 'Alemán',    en: 'German' },
    'italian':    { es: 'Italiano',  en: 'Italian' },
    'italiano':   { es: 'Italiano',  en: 'Italian' },
    'chinese':    { es: 'Chino',     en: 'Chinese' },
    'chino':      { es: 'Chino',     en: 'Chinese' },
    'japanese':   { es: 'Japonés',   en: 'Japanese' },
    'japonés':    { es: 'Japonés',   en: 'Japanese' },
    'korean':     { es: 'Coreano',   en: 'Korean' },
    'coreano':    { es: 'Coreano',   en: 'Korean' },
    'arabic':     { es: 'Árabe',     en: 'Arabic' },
    'árabe':      { es: 'Árabe',     en: 'Arabic' },
    'russian':    { es: 'Ruso',      en: 'Russian' },
    'ruso':       { es: 'Ruso',      en: 'Russian' },
  };
  const LEVEL_NAMES = {
    'native':       { es: 'Nativo',       en: 'Native' },
    'nativo':       { es: 'Nativo',       en: 'Native' },
    'advanced':     { es: 'Avanzado',     en: 'Advanced' },
    'avanzado':     { es: 'Avanzado',     en: 'Advanced' },
    'intermediate': { es: 'Intermedio',   en: 'Intermediate' },
    'intermedio':   { es: 'Intermedio',   en: 'Intermediate' },
    'basic':        { es: 'Básico',       en: 'Basic' },
    'básico':       { es: 'Básico',       en: 'Basic' },
    'fluent':       { es: 'Fluid',        en: 'Fluent' },
    'fluid':        { es: 'Fluid',        en: 'Fluent' },
    'beginner':     { es: 'Principiante', en: 'Beginner' },
    'principiante': { es: 'Principiante', en: 'Beginner' },
  };

  const mapLang = (name) => {
    const key = (name || '').toLowerCase().trim();
    return LANG_NAMES[key]?.[targetLang] ?? name;
  };
  const mapLevel = (level) => {
    const key = (level || '').toLowerCase().trim();
    return LEVEL_NAMES[key]?.[targetLang] ?? level;
  };

  const result = { ...cv };

  // resumen
  if (cv.resumen) result.resumen = await sel(cv.resumen);

  // experiencia
  if (cv.experiencia?.length) {
    const titles = await selList(cv.experiencia.map((e) => e.titulo || ''));
    const descs = await selList(cv.experiencia.map((e) => e.descripcion || ''));
    result.experiencia = cv.experiencia.map((e, i) => ({
      ...e,
      titulo: titles[i],
      descripcion: descs[i]
    }));
  }

  // educacion titles
  if (cv.educacion?.length) {
    const titles = await selList(cv.educacion.map((e) => e.titulo || ''));
    result.educacion = cv.educacion.map((e, i) => ({ ...e, titulo: titles[i] }));
  }

  // skills — se conservan tal cual, nunca se traducen

  // proyectos
  if (cv.proyectos?.length) {
    const titles = await selList(cv.proyectos.map((p) => p.titulo || ''));
    const descs = await selList(cv.proyectos.map((p) => p.descripcion || ''));
    result.proyectos = cv.proyectos.map((p, i) => ({
      ...p,
      titulo: titles[i],
      descripcion: descs[i]
    }));
  }

  // idiomas — mapa directo sin IA
  if (cv.idiomas?.length) {
    result.idiomas = cv.idiomas.map((idi) => ({
      ...idi,
      idioma: mapLang(idi.idioma),
      nivel: mapLevel(idi.nivel)
    }));
  }

  // certificaciones
  if (cv.certificaciones?.length) {
    result.certificaciones = await selList(cv.certificaciones.map((c) => typeof c === 'string' ? c : c.nombre || ''));
  }

  return result;
}

export async function extractSkills(cv) {
  const settings = getSettings();
  if (!settings.apiKey && !AI_PROVIDERS[settings.provider]?.noKey) {
    throw new Error('No hay API key configurada: andá a Configuración y guardala');
  }
  const sections = [];
  if (cv.titulo) sections.push('Title: ' + cv.titulo);
  if (cv.resumen) sections.push('Summary: ' + cv.resumen);
  cv.experiencia?.forEach((e) => {
    sections.push('Job: ' + [e.titulo, e.entidad].filter(Boolean).join(' at '));
    if (e.descripcion) sections.push('Description: ' + e.descripcion);
  });
  cv.educacion?.forEach((e) => {
    sections.push('Education: ' + [e.titulo, e.entidad].filter(Boolean).join(' at '));
  });
  cv.proyectos?.forEach((p) => {
    sections.push('Project: ' + [p.titulo, p.descripcion].filter(Boolean).join(' - '));
  });
  if (!sections.length) throw new Error('El CV está vacío, no hay de qué extraer skills');
  const raw = await chatComplete(settings,
    'Extract all skills from this CV. Output skill names in English, one per line. ' +
    'No categories, no labels, no numbering, no bullet points, no explanations. ' +
    'Translate Spanish skill names to English (e.g. "Gestión de Servicios" → "IT Service Management"). ' +
    'Example output:\nSQL\nPlaywright\nSelenium\nAgile\nProblem-solving',
    sections.join('\n'),
    { maxTokens: 600, temperature: 0.3 }
  );
  const seen = new Set();
  return raw.split('\n')
    .map((s) => s.replace(/^[-•*\d.)\s]+/, '').replace(/^[A-Z][a-z]+:\s*/i, '').trim())
    .filter((s) => s.length > 1 && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}