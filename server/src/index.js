import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { get, all, run, initSchema, parseJson } from './db.js';
import { parseCvColumns } from './cvParser.js';
import { extractPdfColumns } from './pdfText.js';
import { renderCvPdf, TEMPLATES } from './cvPdf.js';
import { getMaskedSettings, saveSettings, improveText, testConnection, translateCv, extractSkills, detectLang } from './ai.js';
import { fetchLinkedInJobs, fetchJobDescription, expandCountries, workTypeForCountry, LinkedInBlockedError } from './linkedin.js';
import { registerUser, loginUser, requireAuth } from './auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const BLOCK_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
let lastLinkedInBlock = 0;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// wrapper para rutas async: captura errores y los pasa al middleware de error
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// evita que errores no capturados maten el proceso
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

// ─── Auth ────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'trabajo-farmer', version: '0.1.0' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body ?? {};
    const user = await registerUser({ email, password, name });
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const result = await loginUser({ email, password });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// ─── CV ──────────────────────────────────────────────────────────────────

async function getCvRow(userId) {
  let row = await get('SELECT data, template, updated_at FROM cv WHERE user_id = ?', [userId]);
  if (!row) {
    await run("INSERT OR IGNORE INTO cv (user_id, data) VALUES (?, '{}')", [userId]);
    row = await get('SELECT data, template, updated_at FROM cv WHERE user_id = ?', [userId]);
  }
  return row;
}

app.get('/api/cv', requireAuth, asyncHandler(async (req, res) => {
  const row = await getCvRow(req.userId);
  res.json({ data: parseJson(row.data, {}), template: row.template, updatedAt: row.updated_at });
}));

app.put('/api/cv', requireAuth, asyncHandler(async (req, res) => {
  const data = JSON.stringify(req.body.data ?? {});
  const template = String(req.body.template ?? 'clasica');
  await run("UPDATE cv SET data = ?, template = ?, updated_at = datetime('now') WHERE user_id = ?", [data, template, req.userId]);
  const row = await getCvRow(req.userId);
  res.json({ data: parseJson(row.data, {}), template: row.template, updatedAt: row.updated_at });
}));

app.post('/api/cv/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }
    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ error: 'Solo se aceptan archivos PDF' });
    }
    const { pages } = await extractPdfColumns(req.file.buffer);
    const columns = pages.flat();
    const rawText = columns.join('\n\n--- PÁGINA / COLUMNA ---\n\n');
    const data = parseCvColumns(columns);
    if (!data.nombre && !data.resumen && data.experiencia.length === 0) {
      return res.status(422).json({ error: 'No se pudo extraer contenido del PDF (¿está escaneado?). Probá con uno con texto seleccionable.' });
    }
    await run("UPDATE cv SET data = ?, raw_text = ?, updated_at = datetime('now') WHERE user_id = ?", [JSON.stringify(data), rawText, req.userId]);
    res.json({ data, extractedChars: rawText.length, pageCount: pages.length });
  } catch (err) {
    console.error('Error al parsear PDF:', err);
    res.status(500).json({ error: 'Error al procesar el PDF: ' + err.message });
  }
});

app.get('/api/cv/export', requireAuth, async (req, res) => {
  try {
    const row = await getCvRow(req.userId);
    let cv = parseJson(row.data, {});
    const template = TEMPLATES[req.query.template] ? req.query.template : row.template;
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    cv = await translateCv(cv, lang, req.userId);
    const { buffer } = await renderCvPdf(cv, template, lang);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cv${lang === 'en' ? '_EN' : ''}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error al exportar PDF:', err);
    res.status(500).json({ error: 'Error al generar el PDF: ' + err.message });
  }
});

app.post('/api/cv/check', requireAuth, async (req, res) => {
  try {
    const row = await getCvRow(req.userId);
    const cv = parseJson(row.data, {});
    const template = TEMPLATES[req.body?.template] ? req.body.template : row.template;
    const { buffer, pageCount, fits } = await renderCvPdf(cv, template);
    const { pages } = await extractPdfColumns(buffer);
    const columns = pages.flat();
    const parsed = parseCvColumns(columns);
    const allText = columns.join(' ');
    const checks = [
      { key: 'texto', label: 'El PDF contiene texto seleccionable (no es imagen)', ok: allText.trim().length > 30 },
      { key: 'una_pagina', label: 'Entra en una sola página', ok: pageCount === 1 },
      { key: 'nombre', label: 'Nombre detectado por el ATS', ok: !!parsed.nombre },
      { key: 'contacto', label: 'Email y teléfono legibles', ok: !!(parsed.email && parsed.telefono) },
      { key: 'resumen', label: 'Resumen / perfil presente', ok: (parsed.resumen ?? '').length >= 40 },
      { key: 'experiencia', label: 'Experiencia laboral detectable', ok: parsed.experiencia.length > 0 },
      { key: 'skills', label: 'Habilidades listadas', ok: parsed.skills.length > 0 },
      { key: 'educacion', label: 'Educación presente', ok: cv.educacion?.length > 0 },
      { key: 'fechas', label: 'Fechas en formato estándar', ok: parsed.experiencia.every((e) => !e.periodo || /^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Presente|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|\d{4})/.test(e.periodo)) },
      { key: 'columna', label: 'Lectura en un solo orden (una columna)', ok: pages.every((cols) => cols.length === 1) },
      { key: 'sidebar', label: 'Plantilla amigable para ATS', ok: template !== 'sidebar' }
    ];
    const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
    res.json({
      score,
      checks,
      pageCount,
      fits,
      warning: !fits ? 'El CV no entra en una sola hoja ni compactado: recortá contenido (descripciones o secciones).' : undefined,
      parsed
    });
  } catch (err) {
    console.error('Error en verificación ATS:', err);
    res.status(500).json({ error: 'Error al verificar el CV: ' + err.message });
  }
});

// ─── Settings (IA por usuario) ───────────────────────────────────────────

app.get('/api/settings', requireAuth, asyncHandler(async (req, res) => res.json(await getMaskedSettings(req.userId))));
app.put('/api/settings', requireAuth, asyncHandler(async (req, res) => {
  await saveSettings(req.userId, req.body ?? {});
  res.json(await getMaskedSettings(req.userId));
}));
app.post('/api/ai/test', requireAuth, async (req, res) => {
  try {
    await testConnection(req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/api/cv/improve', requireAuth, async (req, res) => {
  try {
    const { field = 'resumen', value = '' } = req.body ?? {};
    const improved = await improveText(req.userId, field, String(value));
    res.json({ improved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/api/cv/skills', requireAuth, async (req, res) => {
  try {
    const row = await get('SELECT data FROM cv WHERE user_id = ?', [req.userId]);
    const cv = parseJson(row?.data ?? '{}', {});
    const skills = await extractSkills(cv, req.userId);
    res.json({ skills });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Searches ────────────────────────────────────────────────────────────

function serializeSearch(row) {
  return {
    ...row,
    experienceLevels: parseJson(row.experience_levels, []),
    jobTypes: parseJson(row.job_types, []),
    workTypes: parseJson(row.work_types, []),
    countries: parseJson(row.countries, []),
    remoteOnly: !!row.remote_only,
    active: !!row.active
  };
}

app.get('/api/searches', requireAuth, asyncHandler(async (req, res) => {
  const rows = await all('SELECT * FROM searches WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json(rows.map(serializeSearch));
}));

const CURATED_POSITIONS = [
  'QA Tester', 'QA Automation Engineer', 'QA Manual Tester', 'SDET', 'Software Tester',
  'Test Analyst', 'Quality Analyst', 'Test Automation Engineer', 'QA Lead',
  'Backend Developer', 'Frontend Developer', 'Full Stack Developer', 'Data Analyst',
  'Data Engineer', 'DevOps Engineer', 'Software Engineer', 'Manual Tester',
  'Automation Tester', 'Test Engineer', 'Performance Tester'
];

app.get('/api/searches/suggestions', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const fromDbRows = await all("SELECT DISTINCT title FROM jobs WHERE title != '' ORDER BY title");
  const fromDb = fromDbRows.map((r) => r.title).filter(Boolean);
  const allTitles = [...new Set([...CURATED_POSITIONS, ...fromDb])];
  const filtered = q ? allTitles.filter((t) => t.toLowerCase().includes(q)) : allTitles;
  res.json(filtered.slice(0, 10));
}));

app.post('/api/searches', requireAuth, asyncHandler(async (req, res) => {
  const { name, keywords = '', location = '', geoId = '', experienceLevels = [], jobTypes = [], workTypes = [], countries = [], timePosted = '', companyId = '', remoteOnly = false, active = true } = req.body ?? {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name es obligatorio' });
  }
  const info = await run(`
    INSERT INTO searches (user_id, name, keywords, location, geo_id, experience_levels, job_types, work_types, countries, time_posted, company_id, remote_only, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.userId, String(name).trim(), keywords, location, geoId,
    JSON.stringify(experienceLevels), JSON.stringify(jobTypes), JSON.stringify(workTypes), JSON.stringify(countries),
    timePosted, companyId, remoteOnly ? 1 : 0, active ? 1 : 0
  ]);
  const row = await get('SELECT * FROM searches WHERE id = ?', [Number(info.lastInsertRowid)]);
  res.status(201).json(serializeSearch(row));
}));

app.put('/api/searches/:id', requireAuth, asyncHandler(async (req, res) => {
  const { name, keywords = '', location = '', geoId = '', experienceLevels = [], jobTypes = [], workTypes = [], countries = [], timePosted = '', companyId = '', remoteOnly = false, active = true } = req.body ?? {};
  const info = await run(`
    UPDATE searches SET
      name = ?, keywords = ?, location = ?, geo_id = ?, experience_levels = ?, job_types = ?, work_types = ?, countries = ?, time_posted = ?, company_id = ?, remote_only = ?, active = ?
    WHERE id = ? AND user_id = ?
  `, [
    String(name).trim(), keywords, location, geoId,
    JSON.stringify(experienceLevels), JSON.stringify(jobTypes), JSON.stringify(workTypes), JSON.stringify(countries),
    timePosted, companyId, remoteOnly ? 1 : 0, active ? 1 : 0, Number(req.params.id), req.userId
  ]);
  if (info.changes === 0) return res.status(404).json({ error: 'Búsqueda no encontrada' });
  const row = await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json(serializeSearch(row));
}));

app.delete('/api/searches', requireAuth, asyncHandler(async (req, res) => {
  const rows = await all('SELECT id FROM searches WHERE user_id = ?', [req.userId]);
  const ids = rows.map((r) => Number(r.id));
  for (const id of ids) {
    await run('DELETE FROM job_searches WHERE search_id = ?', [id]);
  }
  await run('DELETE FROM searches WHERE user_id = ?', [req.userId]);
  res.status(204).end();
}));

app.delete('/api/searches/:id', requireAuth, asyncHandler(async (req, res) => {
  const info = await run('DELETE FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (info.changes === 0) return res.status(404).json({ error: 'Búsqueda no encontrada' });
  res.status(204).end();
}));

// ─── Jobs ────────────────────────────────────────────────────────────────

app.get('/api/jobs', requireAuth, asyncHandler(async (req, res) => {
  const { status, searchId, q } = req.query;
  const conditions = ['s.user_id = ?'];
  const params = [req.userId];
  if (status) {
    conditions.push('j.status = ?');
    params.push(status);
  }
  if (q) {
    conditions.push('(j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  let sql = `
    SELECT DISTINCT j.*,
      (SELECT COALESCE(GROUP_CONCAT(js.search_id), '') FROM job_searches js WHERE js.job_id = j.id) AS search_ids
    FROM jobs j
    JOIN job_searches js2 ON js2.job_id = j.id
    JOIN searches s ON s.id = js2.search_id
  `;
  if (searchId) {
    conditions.push('js2.search_id = ?');
    params.push(searchId);
  }
  sql += ` WHERE ${conditions.join(' AND ')} `;
  sql += ` GROUP BY j.id ORDER BY j.created_at DESC `;
  const rows = await all(sql, params);
  res.json(rows.map((row) => ({
    ...row,
    searchIds: row.search_ids ? String(row.search_ids).split(',').map(Number) : []
  })));
}));

app.delete('/api/jobs', requireAuth, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const conditions = ['s.user_id = ?'];
  const params = [req.userId];
  if (status) {
    conditions.push('j.status = ?');
    params.push(status);
  }
  const rows = await all(`
    SELECT DISTINCT j.id FROM jobs j
    JOIN job_searches js ON js.job_id = j.id
    JOIN searches s ON s.id = js.search_id
    WHERE ${conditions.join(' AND ')}
  `, params);

  const userSearchIds = (await all('SELECT id FROM searches WHERE user_id = ?', [req.userId])).map((r) => Number(r.id));
  let deleted = 0;
  for (const r of rows) {
    const jobId = Number(r.id);
    if (userSearchIds.length) {
      await run(`DELETE FROM job_searches WHERE job_id = ? AND search_id IN (${userSearchIds.map(() => '?').join(',')})`, [jobId, ...userSearchIds]);
    }
    const remaining = await get('SELECT COUNT(*) AS c FROM job_searches WHERE job_id = ?', [jobId]);
    if (Number(remaining?.c ?? 0) === 0) {
      await run('DELETE FROM jobs WHERE id = ?', [jobId]);
      deleted += 1;
    }
  }
  res.json({ deleted });
}));

app.patch('/api/jobs/:id', requireAuth, async (req, res) => {
  const { status, notes } = req.body ?? {};
  const owned = await get(`
    SELECT j.id FROM jobs j
    JOIN job_searches js ON js.job_id = j.id
    JOIN searches s ON s.id = js.search_id
    WHERE j.id = ? AND s.user_id = ?
    LIMIT 1
  `, [req.params.id, req.userId]);
  if (!owned) return res.status(404).json({ error: 'Oferta no encontrada' });
  const current = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
  await run('UPDATE jobs SET status = ?, notes = ? WHERE id = ?', [status ?? current.status, notes ?? current.notes, req.params.id]);
  res.json(await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]));
});

app.get('/api/jobs/:id/description', requireAuth, async (req, res) => {
  const owned = await get(`
    SELECT j.id FROM jobs j
    JOIN job_searches js ON js.job_id = j.id
    JOIN searches s ON s.id = js.search_id
    WHERE j.id = ? AND s.user_id = ?
    LIMIT 1
  `, [req.params.id, req.userId]);
  if (!owned) return res.status(404).json({ error: 'Oferta no encontrada' });
  const row = await get('SELECT id, title, description, url FROM jobs WHERE id = ?', [req.params.id]);
  if (row.description) return res.json({ description: row.description, cached: true });
  try {
    const description = await fetchJobDescription(row.url.split('/').filter(Boolean).pop() || String(req.params.id));
    const lang = detectLang(`${row.title} ${description}`);
    await run('UPDATE jobs SET description = ?, language = ? WHERE id = ?', [description, lang === 'unknown' ? '' : lang, row.id]);
    res.json({ description, cached: false });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/jobs/fetch', requireAuth, async (req, res) => {
  try {
    if (Date.now() - lastLinkedInBlock < BLOCK_COOLDOWN_MS) {
      const wait = Math.ceil((BLOCK_COOLDOWN_MS - (Date.now() - lastLinkedInBlock)) / 1000 / 60);
      return res.status(429).json({ error: `LinkedIn te bloqueó hace un momento. Esperá ~${wait} min y volvé a intentar.` });
    }
    let search = req.body?.search;
    let searchId = null;
    if (req.body?.searchId) {
      searchId = Number(req.body.searchId);
      const row = await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [searchId, req.userId]);
      if (!row) return res.status(404).json({ error: 'Búsqueda no encontrada' });
      search = serializeSearch(row);
    }
    if (!search?.keywords && !search?.location && !search?.companyId) {
      return res.status(400).json({ error: 'La búsqueda necesita keywords, ubicación o empresa' });
    }

    const MAX_COUNTRIES_PER_FETCH = 5;
    const forceRemote = !!search.remoteOnly;
    let truncated = false;
    const variants = [];
    if (forceRemote) {
      const baseKeywords = search.keywords ? `${search.keywords} remote` : 'remote';
      variants.push({ ...search, keywords: baseKeywords, workTypes: ['2'], location: '', geoId: '92000000' });
    } else {
      const countryList = expandCountries(search.countries ?? []);
      truncated = countryList.length > MAX_COUNTRIES_PER_FETCH;
      const sliced = truncated ? countryList.slice(0, MAX_COUNTRIES_PER_FETCH) : countryList;
      if (sliced.length) {
        for (const c of sliced) {
          const manual = search.workTypes?.length ? search.workTypes : [workTypeForCountry(c.code)];
          variants.push({ ...search, geoId: c.geoId, workTypes: manual, location: '' });
        }
      } else {
        const manual = search.workTypes?.length ? search.workTypes : (search.geoId ? search.workTypes : []);
        variants.push({ ...search, workTypes: manual });
      }
    }

    let newCount = 0;
    let total = 0;
    const seen = new Set();
    for (let vi = 0; vi < variants.length; vi++) {
      if (vi > 0) await new Promise((r) => setTimeout(r, 10000));
      let fetched;
      try {
        fetched = await fetchLinkedInJobs(variants[vi]);
      } catch (err) {
        if (err instanceof LinkedInBlockedError) {
          lastLinkedInBlock = Date.now();
          return res.status(429).json({ error: err.message + ' Esperá ~3 minutos antes de volver a intentar.' });
        }
        throw err;
      }
      total += fetched.length;
      for (const j of fetched) {
        if (seen.has(j.linkedinId)) continue;
        seen.add(j.linkedinId);
        if (forceRemote && j.onsite === 1) continue;
        const lang = detectLang(j.title);
        let row = await get('SELECT id FROM jobs WHERE linkedin_id = ?', [j.linkedinId]);
        if (!row) {
          const ins = await run(
            'INSERT INTO jobs (linkedin_id, title, company, location, url, description, posted_date, remote, country, language) VALUES (?, ?, ?, ?, ?, \'\', ?, ?, ?, ?)',
            [j.linkedinId, j.title, j.company, j.location, j.url, j.postedDate, j.remote ?? 0, j.country ?? '', lang === 'unknown' ? '' : lang]
          );
          row = { id: Number(ins.lastInsertRowid) };
          newCount += 1;
        } else {
          await run('UPDATE jobs SET title = ?, company = ?, location = ?, posted_date = ?, remote = ?, country = ?, language = ? WHERE id = ?',
            [j.title, j.company, j.location, j.postedDate, j.remote ?? 0, j.country ?? '', lang === 'unknown' ? '' : lang, row.id]);
        }
        if (searchId && row) await run('INSERT OR IGNORE INTO job_searches (job_id, search_id) VALUES (?, ?)', [row.id, searchId]);
      }
    }
    if (searchId) {
      await run("UPDATE searches SET last_run_at = datetime('now') WHERE id = ?", [searchId]);
    }
    res.json({ fetched: total, new: newCount, truncated: truncated ? MAX_COUNTRIES_PER_FETCH : undefined });
  } catch (err) {
    console.error('Error al traer ofertas:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// middleware de error: responde 500 con JSON en vez de dejar que Node crashee
app.use((err, _req, res, _next) => {
  console.error('Error de API:', err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

await initSchema();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API lista en http://localhost:${PORT}`);
});

export default app;