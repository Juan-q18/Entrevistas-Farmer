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

export async function translateCv(cv) {
  const settings = getSettings();
  if (!settings.apiKey && !AI_PROVIDERS[settings.provider]?.noKey) {
    throw new Error('No hay API key configurada: andá a Configuración y guardala');
  }

  const translate = async (text) => {
    if (!text || text.trim().length < 3) return text;
    const raw = await chatComplete(settings,
      'You are a professional translator. Translate the following Spanish text to natural, professional English. Output ONLY the English translation, nothing else.',
      text,
      { maxTokens: 400, temperature: 0.3 }
    );
    return raw.replace(/^["'"''']+|["'"''']+$/g, '').trim() || text;
  };

  const translateList = async (items) => {
    if (!items?.length) return items;
    const numbered = items.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const raw = await chatComplete(settings,
      'You are a professional translator. Translate each numbered item from Spanish to English. Output ONLY the numbered translations, same format, nothing else.',
      numbered,
      { maxTokens: 800, temperature: 0.3 }
    );
    const lines = raw.split('\n').filter((l) => /^\d+\./.test(l.trim()));
    return items.map((orig, i) => {
      const match = lines[i]?.replace(/^\d+\.\s*/, '').trim();
      return match || orig;
    });
  };

  const result = { ...cv };

  // titulo
  if (cv.titulo) result.titulo = await translate(cv.titulo);

  // resumen
  if (cv.resumen) result.resumen = await translate(cv.resumen);

  // experiencia
  if (cv.experiencia?.length) {
    const titles = await translateList(cv.experiencia.map((e) => e.titulo || ''));
    const descs = await translateList(cv.experiencia.map((e) => e.descripcion || ''));
    result.experiencia = cv.experiencia.map((e, i) => ({
      ...e,
      titulo: titles[i],
      descripcion: descs[i]
    }));
  }

  // educacion titles
  if (cv.educacion?.length) {
    const titles = await translateList(cv.educacion.map((e) => e.titulo || ''));
    result.educacion = cv.educacion.map((e, i) => ({ ...e, titulo: titles[i] }));
  }

  // proyectos
  if (cv.proyectos?.length) {
    const titles = await translateList(cv.proyectos.map((p) => p.titulo || ''));
    const descs = await translateList(cv.proyectos.map((p) => p.descripcion || ''));
    result.proyectos = cv.proyectos.map((p, i) => ({
      ...p,
      titulo: titles[i],
      descripcion: descs[i]
    }));
  }

  // idiomas
  if (cv.idiomas?.length) {
    const names = await translateList(cv.idiomas.map((i) => i.idioma || ''));
    const levels = await translateList(cv.idiomas.map((i) => i.nivel || ''));
    result.idiomas = cv.idiomas.map((idi, i) => ({
      ...idi,
      idioma: names[i],
      nivel: levels[i]
    }));
  }

  return result;
}