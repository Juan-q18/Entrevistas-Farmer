const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/;
const DATE_RE = /(19|20)\d{2}/;

const MONTHS = '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)';
const MONTH_YEAR = `${MONTHS}\\.?\\s+\\d{4}`;
const YEAR = '(19|20)\\d{2}';
const RANGE_END = `(?:actualidad|presente?|hoy|\\.{3}|…|${MONTH_YEAR}|${YEAR})`;
const RANGE_RE = new RegExp(`(${MONTH_YEAR}|${YEAR})\\s*[-–—/]\\s*(?:${RANGE_END})?`, 'i');

const SECTIONS = [
  { key: 'resumen', re: /^(sobre\s*m[ií]|resumen|perfil(?:\s+profesional)?|profile|summary|about|objetivo)\s*:?$/i },
  { key: 'experiencia', re: /^(experiencia(?:\s+profesional|\s+laboral)?|work experience|professional experience|employment(?:\s+history)?)\s*:?$/i },
  { key: 'educacion', re: /^(educaci[oó]n|formaci[oó]n(?:\s+(?:acad[ée]mica|complementaria))?|education|estudios)\s*:?$/i },
  { key: 'skills', re: /^(skills|habilidades|aptitudes|competencias|tecnolog[ií]as|conocimientos|herramientas|technical skills|tech stack|tools)\s*:?$/i },
  { key: 'idiomas', re: /^(idiomas|languages)\s*:?$/i },
  { key: 'proyectos', re: /^(proyectos|projects)\s*:?$/i },
  { key: 'certificaciones', re: /^(certificaciones|certificados|certifications|courses|cursos(?:\s+y\s+conferencias)?|conferencias|formaci[oó]n\s+complementaria|licencias)\s*:?$/i }
];

const KNOWN_LANGUAGES = [
  'español', 'espanol', 'castellano', 'ingles', 'inglés', 'english', 'portugues', 'portugués', 'portuguese',
  'frances', 'francés', 'french', 'aleman', 'alemán', 'german', 'italiano', 'italian', 'chino', 'mandarin', 'chinese',
  'japones', 'japonés', 'japanese', 'coreano', 'korean', 'ruso', 'russian', 'arabe', 'árabe', 'arabic', 'catalan', 'catalán',
  'euskera', 'vasco', 'gallego', 'valenciano', 'holandes', 'holandés', 'dutch', 'polaco', 'polish', 'sueco', 'swedish',
  'hebreo', 'hebrew', 'turco', 'turkish', 'griego', 'greek', 'nativo', 'nativa', 'bilingue', 'bilingüe'
];
const LANGUAGE_RE = new RegExp(`^(${KNOWN_LANGUAGES.join('|')})`, 'i');

const LABELED_FIELDS = [
  { key: 'telefono', re: /^telefono|^tel\.?\s*:?/i },
  { key: 'email', re: /^mail|^email|^e-mail|^correo|^e\.?mail/i },
  { key: 'linkedin', re: /^linkedin/i },
  { key: 'web', re: /^web|^website|^sitio|^url|^portfolio/i },
  { key: 'ubicacion', re: /^ubicaci[oó]n|^direcci[oó]n|^address|^location/i }
];

function detectSection(line) {
  for (const s of SECTIONS) {
    if (s.re.test(line)) return s.key;
  }
  return null;
}

const ENTRY_START_RE = /^[A-ZÁÉÍÓÚÑÜ0-9"']/;
const DESC_END_RE = /[.,;:]$/;

function splitEntries(lines) {
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const isPeriod = RANGE_RE.test(line);
    const hasPeriod = cur && cur.lines.some((l) => RANGE_RE.test(l));
    if (!cur) cur = { lines: [] };
    if (isPeriod) {
      const m = line.match(RANGE_RE);
      const prefix = line.slice(0, m.index).trim();
      if (hasPeriod && /\s[–—]\s/.test(prefix)) {
        entries.push(cur.lines);
        cur = { lines: [line] };
      } else {
        cur.lines.push(line);
      }
    } else if (hasPeriod) {
      const continuesDesc = /^[a-záéíóúñü]/.test(line) ||
        line.length >= 55 ||
        (DESC_END_RE.test(line) && !/\s[–—]\s/.test(line));
      const looksLikeTitle = ENTRY_START_RE.test(line) &&
        line.length < 55 &&
        (!DESC_END_RE.test(line) || /\s[–—]\s/.test(line));
      if (looksLikeTitle && !continuesDesc) {
        entries.push(cur.lines);
        cur = { lines: [line] };
      } else {
        cur.lines.push(line);
      }
    } else {
      cur.lines.push(line);
    }
  }
  if (cur) entries.push(cur.lines);
  return entries;
}

function entryFromLines(lines) {
  const periodIndex = lines.findIndex((l) => RANGE_RE.test(l));
  let headLines = lines;
  let periodo = '';
  if (periodIndex >= 0) {
    const periodLine = lines[periodIndex];
    const m = periodLine.match(RANGE_RE);
    periodo = m ? m[0].trim() : '';
    headLines = lines.slice(0, periodIndex);
    const prefix = periodLine.slice(0, m.index).trim();
    if (prefix) headLines.push(prefix);
  }
  if (!headLines.length) return { titulo: '', entidad: '', periodo, descripcion: '' };
  let titulo = headLines[0];
  let entidad = headLines.length > 1 ? headLines[1] : '';
  if (!entidad) {
    const sep = titulo.match(/\s[–—]\s/);
    if (sep) {
      entidad = titulo.slice(sep.index + 3).trim();
      titulo = titulo.slice(0, sep.index).trim();
    }
  }
  const descripcion = periodIndex >= 0 ? lines.slice(periodIndex + 1).join(' ').slice(0, 800) : '';
  return { titulo, entidad, periodo, descripcion };
}

function splitHeaderLines(lines) {
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-zÁÉÍÓÚÑÜáéíóúñü\s]{3,45}):\s*(.+)$/);
    if (m && detectSection(m[1])) {
      out.push(m[1].trim());
      out.push(m[2].trim());
      continue;
    }
    out.push(line);
  }
  return out;
}

export function parseCvText(rawText) {
  let lines = rawText
    .replace(/\f/g, '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((l) => !/^(p[ae]g(ina)?\s*\d+|page\s*\d+|\d+\s*\/\s*\d+|--\s*\d+\s+of\s+\d+\s*--)$/i.test(l));

  const cv = {
    nombre: '', titulo: '', email: '', telefono: '', ubicacion: '', linkedin: '', web: '',
    resumen: '', experiencia: [], educacion: [], skills: [], idiomas: [], proyectos: [], certificaciones: []
  };

  const emailLine = lines.find((l) => EMAIL_RE.test(l));
  if (emailLine) cv.email = (emailLine.match(EMAIL_RE) ?? [''])[0];

  const phoneLine = lines.find((l) => PHONE_RE.test(l));
  if (phoneLine) cv.telefono = (phoneLine.match(PHONE_RE) ?? [''])[0];

  const socialLine = lines.find((l) => /linkedin\.com|github\.com/i.test(l));
  if (socialLine) {
    cv.linkedin = (socialLine.match(/https?:\/\/(?:[\w.-]+\.)?(?:linkedin|github)\.com\/[\w./-]+/i) ?? socialLine.match(/(?:linkedin|github)\.com\/[\w./-]+/i) ?? [''])[0];
  }

  const otherUrlLine = lines.find((l) => /https?:\/\//i.test(l) && !/linkedin\.com|github\.com/i.test(l));
  if (otherUrlLine) cv.web = (otherUrlLine.match(/https?:\/\/[\w./-]+/i) ?? [''])[0];

  const contactLines = [emailLine, phoneLine, socialLine, otherUrlLine].filter(Boolean);

  for (const line of [...lines]) {
    for (const field of LABELED_FIELDS) {
      const m = line.match(new RegExp(`^${field.re.source}\\s*:?\\s*(.+)$`, 'i'));
      if (m && m[1] && m[1].length < 80 && !RANGE_RE.test(m[1])) {
        if (!cv[field.key]) cv[field.key] = m[1].trim();
        contactLines.push(line);
        break;
      }
    }
  }

  lines = splitHeaderLines(lines.filter((l) => !contactLines.includes(l)));

  const candidateLines = [...lines];
  if (candidateLines.length) {
    const first = candidateLines[0];
    if (first.length <= 70 && !DATE_RE.test(first) && !detectSection(first)) {
      cv.nombre = first;
      const second = candidateLines[1];
      if (second && second.length <= 70 && !DATE_RE.test(second) && !detectSection(second)) {
        cv.titulo = second;
      }
    }
  }

  let section = null;
  const buckets = {};
  const nameIdx = cv.nombre && candidateLines[0] === cv.nombre ? 0 : -1;
  const titleIdx = cv.titulo && nameIdx === 0 && candidateLines[1] === cv.titulo ? 1 : -1;
  for (let i = 0; i < candidateLines.length; i++) {
    const line = candidateLines[i];
    const next = detectSection(line);
    if (next) {
      section = next;
      continue;
    }
    if (!section || i === nameIdx || i === titleIdx) continue;
    (buckets[section] ??= []).push(line);
  }

  cv.resumen = (buckets.resumen ?? []).slice(0, 12).join(' ').slice(0, 900);
  cv.experiencia = splitEntries(buckets.experiencia ?? []).map(entryFromLines).filter((e) => e.titulo);
  cv.educacion = splitEntries(buckets.educacion ?? []).map(entryFromLines).filter((e) => e.titulo);
  cv.proyectos = splitEntries(buckets.proyectos ?? []).map(entryFromLines).filter((e) => e.titulo);

  cv.skills = [...new Set(
    (buckets.skills ?? []).flatMap((l) => l.split(/[,;|•·]/)).map((s) => s.trim()).filter((s) => s.length > 1)
  )].slice(0, 40);

  cv.idiomas = (buckets.idiomas ?? [])
    .map((l) => {
      const parts = l.split(/[-–—:]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1 && LANGUAGE_RE.test(parts[0])) {
        return { idioma: parts[0], nivel: parts.slice(1).join(' ') };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 12);

  cv.certificaciones = [...new Set((buckets.certificaciones ?? []).map((s) => s.trim()))].slice(0, 30);

  return cv;
}

export function mergeCvs(list) {
  const out = {};
  const scalarKeys = ['nombre', 'titulo', 'email', 'telefono', 'ubicacion', 'linkedin', 'web', 'resumen'];
  for (const k of scalarKeys) out[k] = list.map((c) => c[k]).find(Boolean) ?? '';
  const arrKeys = ['experiencia', 'educacion', 'proyectos', 'idiomas', 'skills', 'certificaciones'];
  for (const k of arrKeys) {
    const seen = new Set();
    out[k] = [];
    for (const c of list) {
      for (const item of c[k] ?? []) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          out[k].push(item);
        }
      }
    }
  }
  return out;
}

export function parseCvColumns(columns) {
  const parsed = (columns ?? []).map((col) => parseCvText(col));
  return parsed.length ? mergeCvs(parsed) : parseCvText('');
}