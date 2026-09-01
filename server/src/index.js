import express from 'express';
import cors from 'cors';
import multer from 'multer';
import db, { parseJson } from './db.js';
import { parseCvColumns } from './cvParser.js';
import { extractPdfColumns } from './pdfText.js';
import { renderCvPdf, TEMPLATES } from './cvPdf.js';
import { getMaskedSettings, saveSettings, improveText, testConnection, translateCv, extractSkills, detectLang } from './ai.js';
import { fetchLinkedInJobs, fetchJobDescription, expandCountries, workTypeForCountry } from './linkedin.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'trabajo-farmer', version: '0.1.0' });
});

app.get('/api/cv', (_req, res) => {
  const row = db.prepare('SELECT data, template, updated_at FROM cv WHERE id = 1').get();
  res.json({ data: parseJson(row.data, {}), template: row.template, updatedAt: row.updated_at });
});

app.put('/api/cv', (req, res) => {
  const data = JSON.stringify(req.body.data ?? {});
  const template = String(req.body.template ?? 'clasica');
  db.prepare('UPDATE cv SET data = ?, template = ?, updated_at = datetime(\'now\') WHERE id = 1').run(data, template);
  const row = db.prepare('SELECT data, template, updated_at FROM cv WHERE id = 1').get();
  res.json({ data: parseJson(row.data, {}), template: row.template, updatedAt: row.updated_at });
});

app.post('/api/cv/upload', upload.single('file'), async (req, res) => {
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
    db.prepare('UPDATE cv SET data = ?, raw_text = ?, updated_at = datetime(\'now\') WHERE id = 1').run(JSON.stringify(data), rawText);
    res.json({ data, extractedChars: rawText.length, pageCount: pages.length });
  } catch (err) {
    console.error('Error al parsear PDF:', err);
    res.status(500).json({ error: 'Error al procesar el PDF: ' + err.message });
  }
});

app.get('/api/cv/export', async (req, res) => {
  try {
    const row = db.prepare('SELECT data, template FROM cv WHERE id = 1').get();
    let cv = parseJson(row.data, {});
    const template = TEMPLATES[req.query.template] ? req.query.template : row.template;
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    cv = await translateCv(cv, lang);
    const { buffer } = await renderCvPdf(cv, template, lang);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cv${lang === 'en' ? '_EN' : ''}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error al exportar PDF:', err);
    res.status(500).json({ error: 'Error al generar el PDF: ' + err.message });
  }
});

app.post('/api/cv/check', async (req, res) => {
  try {
    const row = db.prepare('SELECT data, template FROM cv WHERE id = 1').get();
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

app.get('/api/settings', (_req, res) => res.json(getMaskedSettings()));
app.put('/api/settings', (req, res) => {
  saveSettings(req.body ?? {});
  res.json(getMaskedSettings());
});
app.post('/api/ai/test', async (_req, res) => {
  try {
    await testConnection();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/api/cv/improve', async (req, res) => {
  try {
    const { field = 'resumen', value = '' } = req.body ?? {};
    const improved = await improveText(field, String(value));
    res.json({ improved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/api/cv/skills', async (_req, res) => {
  try {
    const row = db.prepare('SELECT data FROM cv WHERE id = 1').get();
    const cv = parseJson(row?.data ?? '{}', {});
    const skills = await extractSkills(cv);
    res.json({ skills });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function serializeSearch(row) {
  return {
    ...row,
    experienceLevels: parseJson(row.experience_levels, []),
    jobTypes: parseJson(row.job_types, []),
    workTypes: parseJson(row.work_types, []),
    countries: parseJson(row.countries, []),
    active: !!row.active
  };
}

app.get('/api/searches', (_req, res) => {
  const rows = db.prepare('SELECT * FROM searches ORDER BY created_at DESC').all();
  res.json(rows.map(serializeSearch));
});

app.post('/api/searches', (req, res) => {
  const { name, keywords = '', location = '', geoId = '', experienceLevels = [], jobTypes = [], workTypes = [], countries = [], timePosted = '', companyId = '', active = true } = req.body ?? {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name es obligatorio' });
  }
  const info = db.prepare(`
    INSERT INTO searches (name, keywords, location, geo_id, experience_levels, job_types, work_types, countries, time_posted, company_id, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(), keywords, location, geoId,
    JSON.stringify(experienceLevels), JSON.stringify(jobTypes), JSON.stringify(workTypes), JSON.stringify(countries),
    timePosted, companyId, active ? 1 : 0
  );
  const row = db.prepare('SELECT * FROM searches WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeSearch(row));
});

app.put('/api/searches/:id', (req, res) => {
  const { name, keywords = '', location = '', geoId = '', experienceLevels = [], jobTypes = [], workTypes = [], countries = [], timePosted = '', companyId = '', active = true } = req.body ?? {};
  const info = db.prepare(`
    UPDATE searches SET
      name = ?, keywords = ?, location = ?, geo_id = ?, experience_levels = ?, job_types = ?, work_types = ?, countries = ?, time_posted = ?, company_id = ?, active = ?
    WHERE id = ?
  `).run(
    String(name).trim(), keywords, location, geoId,
    JSON.stringify(experienceLevels), JSON.stringify(jobTypes), JSON.stringify(workTypes), JSON.stringify(countries),
    timePosted, companyId, active ? 1 : 0, Number(req.params.id)
  );
  if (info.changes === 0) return res.status(404).json({ error: 'Búsqueda no encontrada' });
  const row = db.prepare('SELECT * FROM searches WHERE id = ?').get(req.params.id);
  res.json(serializeSearch(row));
});

app.delete('/api/searches', (req, res) => {
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM searches').run();
  res.status(204).end();
});

app.delete('/api/searches/:id', (req, res) => {
  const info = db.prepare('DELETE FROM searches WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Búsqueda no encontrada' });
  res.status(204).end();
});

app.get('/api/jobs', (req, res) => {
  const { status, searchId, q } = req.query;
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('j.status = ?');
    params.push(status);
  }
  if (q) {
    conditions.push('(j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  let sql = `
    SELECT j.*, COALESCE(GROUP_CONCAT(js.search_id), '') AS search_ids
    FROM jobs j
    LEFT JOIN job_searches js ON js.job_id = j.id
  `;
  if (searchId) {
    sql += ` JOIN job_searches jsf ON jsf.job_id = j.id AND jsf.search_id = ? `;
    params.push(searchId);
  }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')} `;
  sql += ` GROUP BY j.id ORDER BY j.created_at DESC `;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((row) => ({
    ...row,
    searchIds: row.search_ids ? String(row.search_ids).split(',').map(Number) : []
  })));
});

app.patch('/api/jobs/:id', (req, res) => {
  const { status, notes } = req.body ?? {};
  const current = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Oferta no encontrada' });
  db.prepare('UPDATE jobs SET status = ?, notes = ? WHERE id = ?').run(
    status ?? current.status,
    notes ?? current.notes,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
});

app.get('/api/jobs/:id/description', async (req, res) => {
  const row = db.prepare('SELECT id, title, description, url FROM jobs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Oferta no encontrada' });
  if (row.description) return res.json({ description: row.description, cached: true });
  try {
    const description = await fetchJobDescription(row.url.split('/').filter(Boolean).pop() || String(req.params.id));
    const lang = detectLang(`${row.title} ${description}`);
    db.prepare('UPDATE jobs SET description = ?, language = ? WHERE id = ?').run(description, lang === 'unknown' ? '' : lang, row.id);
    res.json({ description, cached: false });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/jobs/fetch', async (req, res) => {
  try {
    let search = req.body?.search;
    let searchId = null;
    if (req.body?.searchId) {
      searchId = Number(req.body.searchId);
      const row = db.prepare('SELECT * FROM searches WHERE id = ?').get(searchId);
      if (!row) return res.status(404).json({ error: 'Búsqueda no encontrada' });
      search = serializeSearch(row);
    }
    if (!search?.keywords && !search?.location && !search?.companyId) {
      return res.status(400).json({ error: 'La búsqueda necesita keywords, ubicación o empresa' });
    }

    // expandir países/continentes seleccionados → lista de { code, geoId, name }
    const countryList = expandCountries(search.countries ?? []);
    // variantes de búsqueda: una por país (cada una con su geoId y work type)
    const variants = [];
    if (countryList.length) {
      for (const c of countryList) {
        const manual = search.workTypes?.length ? search.workTypes : [workTypeForCountry(c.code)];
        variants.push({ ...search, geoId: c.geoId, workTypes: manual, location: '' });
      }
    } else {
      const manual = search.workTypes?.length ? search.workTypes : (search.geoId ? search.workTypes : []);
      variants.push({ ...search, workTypes: manual });
    }

    const find = db.prepare('SELECT id FROM jobs WHERE linkedin_id = ?');
    const insert = db.prepare(
      'INSERT INTO jobs (linkedin_id, title, company, location, url, description, posted_date, remote, country, language) VALUES (?, ?, ?, ?, ?, \'\', ?, ?, ?, ?)'
    );
    const update = db.prepare('UPDATE jobs SET title = ?, company = ?, location = ?, posted_date = ?, remote = ?, country = ?, language = ? WHERE id = ?');
    const link = db.prepare('INSERT OR IGNORE INTO job_searches (job_id, search_id) VALUES (?, ?)');

    let newCount = 0;
    let total = 0;
    const seen = new Set();
    for (let vi = 0; vi < variants.length; vi++) {
      if (vi > 0) await new Promise((r) => setTimeout(r, 2500));
      const fetched = await fetchLinkedInJobs(variants[vi]);
      total += fetched.length;
      for (const j of fetched) {
        if (seen.has(j.linkedinId)) continue;
        seen.add(j.linkedinId);
        const lang = detectLang(j.title);
        let row = find.get(j.linkedinId);
        if (!row) {
          insert.run(j.linkedinId, j.title, j.company, j.location, j.url, j.postedDate, j.remote ?? 0, j.country ?? '', lang === 'unknown' ? '' : lang);
          row = find.get(j.linkedinId);
          newCount += 1;
        } else {
          update.run(j.title, j.company, j.location, j.postedDate, j.remote ?? 0, j.country ?? '', lang === 'unknown' ? '' : lang, row.id);
        }
        if (searchId && row) link.run(row.id, searchId);
      }
    }
    if (searchId) {
      db.prepare("UPDATE searches SET last_run_at = datetime('now') WHERE id = ?").run(searchId);
    }
    res.json({ fetched: total, new: newCount });
  } catch (err) {
    console.error('Error al traer ofertas:', err.message);
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API lista en http://localhost:${PORT}`);
});