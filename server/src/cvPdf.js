import PDFDocument from 'pdfkit';

const EMERALD = '#047857';
const SLATE = '#334155';
const DARK = '#1e293b';
const GRAY = '#64748b';
const LIGHT = '#e2e8f0';

export const TEMPLATES = {
  clasica: { label: 'Clásica', description: 'Estructura tradicional, sobria y legible' },
  moderna: { label: 'Moderna', description: 'Acentos en verde esmeralda y secciones marcadas' },
  minimal: { label: 'Minimal', description: 'Serif Times, espaciado amplio, sin ruido' },
  sidebar: { label: 'Sidebar', description: 'Dos columnas con panel lateral oscuro', atsRisk: true }
};

let S = 1;
const fs = (n) => n * S;
const md = (n) => n * S;

const DENSITY_LEVELS = [
  { scale: 1, margin: 48 },
  { scale: 0.93, margin: 44 },
  { scale: 0.86, margin: 40 },
  { scale: 0.8, margin: 36 },
  { scale: 0.74, margin: 32 }
];

const MONTH_ABBR_ES = {
  enero: 'Ene', febrero: 'Feb', marzo: 'Mar', abril: 'Abr', mayo: 'May', junio: 'Jun',
  julio: 'Jul', agosto: 'Ago', septiembre: 'Sep', octubre: 'Oct', noviembre: 'Nov', diciembre: 'Dic',
  january: 'Ene', february: 'Feb', march: 'Mar', april: 'Abr', may: 'May', june: 'Jun',
  july: 'Jul', august: 'Ago', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dic',
  jan: 'Ene', feb: 'Feb', mar: 'Mar', apr: 'Abr', jun: 'Jun', jul: 'Jul',
  aug: 'Ago', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dic',
  presente: 'Presente', present: 'Presente'
};
const MONTH_ABBR_EN = {
  enero: 'Jan', febrero: 'Feb', marzo: 'Mar', abril: 'Apr', mayo: 'May', junio: 'Jun',
  julio: 'Jul', agosto: 'Aug', septiembre: 'Sep', octubre: 'Oct', noviembre: 'Nov', diciembre: 'Dec',
  january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun',
  july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec',
  ene: 'Jan', feb: 'Feb', mar: 'Mar', abr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul',
  ago: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dec',
  presente: 'Present', present: 'Present'
};

let LANG = 'es';

const SECTION_TITLES = {
  resumen:         { es: 'Resumen',         en: 'Summary' },
  experiencia:     { es: 'Experiencia',     en: 'Experience' },
  educacion:       { es: 'Educacion',       en: 'Education' },
  skills:          { es: 'Skills',          en: 'Skills' },
  idiomas:         { es: 'Idiomas',         en: 'Languages' },
  proyectos:       { es: 'Proyectos',       en: 'Projects' },
  certificaciones: { es: 'Certificaciones', en: 'Certifications' },
};
function st(key) { return SECTION_TITLES[key]?.[LANG] ?? SECTION_TITLES[key]?.es ?? key; }

function normalizePeriod(p) {
  if (!p) return '';
  const map = LANG === 'en' ? MONTH_ABBR_EN : MONTH_ABBR_ES;
  const allKeys = [...Object.keys(MONTH_ABBR_ES), ...Object.keys(MONTH_ABBR_EN)];
  const re = new RegExp(`\\b(${[...new Set(allKeys)].join('|')})\\b`, 'gi');
  return p.replace(re, (m) => map[m.toLowerCase()] ?? m);
}

function contactLine(cv) {
  return [cv.email, cv.telefono, cv.ubicacion, cv.linkedin, cv.web].filter(Boolean);
}

function needsPage(doc, reserve = 120) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - md(reserve)) doc.addPage();
}

function header(doc, cv, accent, { font = 'Helvetica-Bold', size = 22 } = {}) {
  doc.fillColor(DARK).font(font).fontSize(fs(size)).text(cv.nombre || 'Tu nombre', { lineGap: md(2) });
  if (cv.titulo) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(fs(13)).text(cv.titulo);
  }
  const contact = contactLine(cv);
  if (contact.length) {
    doc.moveDown(md(0.4));
    doc.fillColor(accent).font('Helvetica').fontSize(fs(9)).text(contact.join('   ·   '));
  }
  doc.moveDown(md(0.6));
}

function entries(doc, items, { accent, titleColor = SLATE, headFont = 'Helvetica-Bold', periodInline = false } = {}) {
  for (const item of items) {
    needsPage(doc);
    const head = [item.titulo, item.entidad].filter(Boolean).join(' — ');
    const periodo = normalizePeriod(item.periodo);
    if (head) {
      if (periodInline && periodo) {
        doc.fillColor(titleColor).font(headFont).fontSize(fs(10.5)).text(`${head}   ${periodo}`, { continued: false });
      } else {
        doc.fillColor(titleColor).font(headFont).fontSize(fs(10.5)).text(head, { continued: false });
      }
    }
    if (!periodInline && periodo) {
      doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(fs(9.5)).text(periodo);
    }
    if (item.descripcion) {
      doc.fillColor(titleColor).font('Helvetica').fontSize(fs(9.5)).text(item.descripcion, { lineGap: md(2) });
    }
    if (item.link) {
      doc.fillColor(accent).font('Helvetica').fontSize(fs(9)).text(item.link);
    }
    doc.moveDown(md(0.5));
  }
}

function sectionTitle(doc, title, { accent = EMERALD, textColor = SLATE, font = 'Helvetica-Bold', size = 12, uppercase = true, rule = true } = {}) {
  needsPage(doc);
  doc.moveDown(md(1.1));
  doc.fillColor(textColor).font(font).fontSize(fs(size)).text(uppercase ? title.toUpperCase() : title);
  if (rule) {
    doc.moveDown(md(0.25));
    doc.strokeColor(accent).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(md(0.6));
  } else {
    doc.moveDown(md(0.6));
  }
}

function skillsBlock(doc, skills, { accent = EMERALD, textColor = SLATE } = {}) {
  needsPage(doc);
  const joined = skills.join(', ');
  doc.fillColor(textColor).font('Helvetica').fontSize(fs(10)).text(joined, { lineGap: md(3) });
}

function idiomasBlock(doc, idiomas, { textColor = SLATE } = {}) {
  needsPage(doc);
  for (const id of idiomas) {
    doc.fillColor(textColor).font('Helvetica').fontSize(fs(10)).text([id.idioma, id.nivel].filter(Boolean).join(' — '));
  }
}

function certificacionesBlock(doc, items, { accent = EMERALD, textColor = SLATE } = {}) {
  needsPage(doc);
  for (const c of items) {
    doc.fillColor(textColor).font('Helvetica').fontSize(fs(10)).text(`• ${c}`);
  }
}

function buildClasica(doc, cv) {
  header(doc, cv, GRAY, { size: 22 });
  doc.strokeColor(LIGHT).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  if (cv.resumen) {
    sectionTitle(doc, st('resumen'), { accent: LIGHT, textColor: DARK });
    doc.fillColor(SLATE).font('Helvetica').fontSize(fs(10)).text(cv.resumen, { lineGap: md(3) });
  }
  if (cv.experiencia?.length) {
    sectionTitle(doc, st('experiencia'), { accent: LIGHT, textColor: DARK });
    entries(doc, cv.experiencia, { accent: DARK, titleColor: SLATE, headFont: 'Helvetica-Bold' });
  }
  if (cv.educacion?.length) {
    sectionTitle(doc, st('educacion'), { accent: LIGHT, textColor: DARK });
    entries(doc, cv.educacion, { accent: DARK, titleColor: SLATE, headFont: 'Helvetica-Bold' });
  }
  if (cv.skills?.length) {
    sectionTitle(doc, st('skills'), { accent: LIGHT, textColor: DARK });
    skillsBlock(doc, cv.skills);
  }
  if (cv.idiomas?.length) {
    sectionTitle(doc, st('idiomas'), { accent: LIGHT, textColor: DARK });
    idiomasBlock(doc, cv.idiomas);
  }
  if (cv.proyectos?.length) {
    sectionTitle(doc, st('proyectos'), { accent: LIGHT, textColor: DARK });
    entries(doc, cv.proyectos, { accent: DARK, titleColor: SLATE, headFont: 'Helvetica-Bold' });
  }
  if (cv.certificaciones?.length) {
    sectionTitle(doc, st('certificaciones'), { accent: LIGHT, textColor: DARK });
    certificacionesBlock(doc, cv.certificaciones);
  }
}

function buildModerna(doc, cv) {
  header(doc, cv, EMERALD, { size: 24 });
  doc.strokeColor(EMERALD).lineWidth(2.5).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(md(0.3));
  if (cv.resumen) {
    sectionTitle(doc, st('resumen'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    doc.fillColor(SLATE).font('Helvetica').fontSize(fs(10)).text(cv.resumen, { lineGap: md(3) });
  }
  if (cv.experiencia?.length) {
    sectionTitle(doc, st('experiencia'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    entries(doc, cv.experiencia, { accent: EMERALD, titleColor: SLATE, periodInline: true });
  }
  if (cv.educacion?.length) {
    sectionTitle(doc, st('educacion'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    entries(doc, cv.educacion, { accent: EMERALD, titleColor: SLATE, periodInline: true });
  }
  if (cv.skills?.length) {
    sectionTitle(doc, st('skills'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    skillsBlock(doc, cv.skills, { accent: EMERALD });
  }
  if (cv.idiomas?.length) {
    sectionTitle(doc, st('idiomas'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    idiomasBlock(doc, cv.idiomas);
  }
  if (cv.proyectos?.length) {
    sectionTitle(doc, st('proyectos'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    entries(doc, cv.proyectos, { accent: EMERALD, titleColor: SLATE, periodInline: true });
  }
  if (cv.certificaciones?.length) {
    sectionTitle(doc, st('certificaciones'), { accent: EMERALD, textColor: EMERALD, size: 11 });
    certificacionesBlock(doc, cv.certificaciones, { accent: EMERALD });
  }
}

function buildMinimal(doc, cv) {
  header(doc, cv, GRAY, { font: 'Times-Bold', size: 26 });
  if (cv.resumen) {
    sectionTitle(doc, st('resumen'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    doc.fillColor(SLATE).font('Times-Roman').fontSize(fs(10.5)).text(cv.resumen, { lineGap: md(3) });
  }
  if (cv.experiencia?.length) {
    sectionTitle(doc, st('experiencia'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    entries(doc, cv.experiencia, { accent: GRAY, titleColor: SLATE, headFont: 'Times-Bold', periodInline: true });
  }
  if (cv.educacion?.length) {
    sectionTitle(doc, st('educacion'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    entries(doc, cv.educacion, { accent: GRAY, titleColor: SLATE, headFont: 'Times-Bold', periodInline: true });
  }
  if (cv.skills?.length) {
    sectionTitle(doc, st('skills'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    skillsBlock(doc, cv.skills, { textColor: SLATE });
  }
  if (cv.idiomas?.length) {
    sectionTitle(doc, st('idiomas'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    idiomasBlock(doc, cv.idiomas);
  }
  if (cv.proyectos?.length) {
    sectionTitle(doc, st('proyectos'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    entries(doc, cv.proyectos, { accent: GRAY, titleColor: SLATE, headFont: 'Times-Bold', periodInline: true });
  }
  if (cv.certificaciones?.length) {
    sectionTitle(doc, st('certificaciones'), { accent: LIGHT, textColor: DARK, font: 'Times-Bold', size: 11, uppercase: false });
    certificacionesBlock(doc, cv.certificaciones, { textColor: SLATE });
  }
}

function buildSidebar(doc, cv) {
  const { left, right, top, bottom } = doc.page.margins;
  const sW = md(150);
  const sX = left;
  const mX = left + sW + md(20);
  const mainW = doc.page.width - left - right - sW - md(20);

  doc.save();
  doc.rect(sX, top, sW, doc.page.height - top - bottom).fill(DARK);
  doc.restore();

  let yMain = top;
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(fs(22)).text(cv.nombre || 'Tu nombre', mX, yMain, { width: mainW });
  yMain = doc.y + md(2);
  if (cv.titulo) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(fs(13)).text(cv.titulo, mX, yMain, { width: mainW });
    yMain = doc.y + md(2);
  }
  const contact = contactLine(cv);
  if (contact.length) {
    doc.fillColor(DARK).font('Helvetica').fontSize(fs(9)).text(contact.join('   ·   '), mX, yMain, { width: mainW });
    yMain = doc.y + md(6);
  }
  yMain += md(8);

  const sideSections = [
    cv.skills?.length && {
      title: st('skills'),
      render: (y) => {
        for (const s of cv.skills) {
          doc.fillColor('#cbd5e1').font('Helvetica').fontSize(fs(9)).text(`• ${s}`, sX, y, { width: sW - md(6) });
          y = doc.y + md(2);
        }
      }
    },
    cv.idiomas?.length && {
      title: st('idiomas'),
      render: (y) => {
        for (const id of cv.idiomas) {
          doc.fillColor('#cbd5e1').font('Helvetica').fontSize(fs(9)).text([id.idioma, id.nivel].filter(Boolean).join(' — '), sX, y, { width: sW - md(6) });
          y = doc.y + md(2);
        }
      }
    },
    cv.certificaciones?.length && {
      title: st('certificaciones'),
      render: (y) => {
        for (const c of cv.certificaciones) {
          doc.fillColor('#cbd5e1').font('Helvetica').fontSize(fs(9)).text(`• ${c}`, sX, y, { width: sW - md(6) });
          y = doc.y + md(2);
        }
      }
    }
  ].filter(Boolean);

  let ySide = top + md(4);
  for (const sec of sideSections) {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fs(10)).text(sec.title.toUpperCase(), sX, ySide, { width: sW - md(6) });
    ySide = doc.y + md(3);
    doc.strokeColor('#64748b').lineWidth(0.5).moveTo(sX, ySide).lineTo(sX + sW - md(6), ySide).stroke();
    ySide += md(8);
    sec.render(ySide);
    ySide = doc.y + md(12);
  }

  const mainSections = [
    cv.resumen && {
      title: st('resumen'),
      render: (y) => {
        doc.fillColor(SLATE).font('Helvetica').fontSize(fs(10)).text(cv.resumen, mX, y, { width: mainW, lineGap: md(3) });
      }
    },
    cv.experiencia?.length && {
      title: st('experiencia'),
      render: (y) => {
        for (const item of cv.experiencia) {
          const head = [item.titulo, item.entidad].filter(Boolean).join(' — ');
          const periodo = normalizePeriod(item.periodo);
          if (head) doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(fs(10.5)).text(head, mX, y, { width: mainW });
          y = doc.y + md(1);
          if (periodo) doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(fs(9.5)).text(periodo, mX, y, { width: mainW });
          if (item.descripcion) {
            y = doc.y + md(2);
            doc.fillColor(SLATE).font('Helvetica').fontSize(fs(9.5)).text(item.descripcion, mX, y, { width: mainW, lineGap: md(2) });
          }
          y = doc.y + md(6);
        }
      }
    },
    cv.educacion?.length && {
      title: st('educacion'),
      render: (y) => {
        for (const item of cv.educacion) {
          const head = [item.titulo, item.entidad].filter(Boolean).join(' — ');
          const periodo = normalizePeriod(item.periodo);
          if (head) doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(fs(10.5)).text(head, mX, y, { width: mainW });
          y = doc.y + md(1);
          if (periodo) doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(fs(9.5)).text(periodo, mX, y, { width: mainW });
          if (item.descripcion) {
            y = doc.y + md(2);
            doc.fillColor(SLATE).font('Helvetica').fontSize(fs(9.5)).text(item.descripcion, mX, y, { width: mainW, lineGap: md(2) });
          }
          y = doc.y + md(6);
        }
      }
    },
    cv.proyectos?.length && {
      title: st('proyectos'),
      render: (y) => {
        for (const item of cv.proyectos) {
          const head = [item.titulo, item.entidad].filter(Boolean).join(' — ');
          if (head) doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(fs(10.5)).text(head, mX, y, { width: mainW });
          if (item.descripcion) {
            y = doc.y + md(2);
            doc.fillColor(SLATE).font('Helvetica').fontSize(fs(9.5)).text(item.descripcion, mX, y, { width: mainW, lineGap: md(2) });
          }
          if (item.link) {
            y = doc.y + md(2);
            doc.fillColor(EMERALD).font('Helvetica').fontSize(fs(9)).text(item.link, mX, y, { width: mainW });
          }
          y = doc.y + md(6);
        }
      }
    }
  ].filter(Boolean);

  for (const sec of mainSections) {
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(fs(11)).text(sec.title.toUpperCase(), mX, yMain, { width: mainW });
    yMain = doc.y + md(2);
    doc.strokeColor(DARK).lineWidth(1).moveTo(mX, yMain).lineTo(mX + mainW, yMain).stroke();
    yMain += md(8);
    sec.render(yMain);
    yMain = doc.y + md(12);
  }
}

export function buildCvPdf(doc, cv, template = 'clasica', scale = 1, lang = 'es') {
  S = scale;
  LANG = lang;
  const builders = { clasica: buildClasica, moderna: buildModerna, minimal: buildMinimal, sidebar: buildSidebar };
  (builders[template] ?? buildClasica)(doc, cv);
}

function renderOnce(cv, template, level, lang) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: level.margin, bufferPages: true });
    const chunks = [];
    let pages = 1;
    doc.on('pageAdded', () => { pages += 1; });
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => {
      resolve({ buffer: Buffer.concat(chunks), pageCount: pages });
    });
    buildCvPdf(doc, cv, template, level.scale, lang);
    doc.end();
  });
}

export async function renderCvPdf(cv, template = 'clasica', lang = 'es') {
  for (const level of DENSITY_LEVELS) {
    const result = await renderOnce(cv, template, level, lang);
    if (result.pageCount <= 1) {
      return { ...result, scale: level.scale, fits: true };
    }
  }
  const last = await renderOnce(cv, template, DENSITY_LEVELS[DENSITY_LEVELS.length - 1], lang);
  return { ...last, scale: DENSITY_LEVELS[DENSITY_LEVELS.length - 1].scale, fits: false };
}