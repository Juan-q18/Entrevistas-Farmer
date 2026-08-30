import { useCallback, useEffect, useRef, useState } from 'react';

const emptyCv = {
  nombre: '', titulo: '', email: '', telefono: '', ubicacion: '', linkedin: '', web: '',
  resumen: '',
  experiencia: [], educacion: [], skills: [], idiomas: [], proyectos: [], certificaciones: []
};

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 17 }, (_, i) => 2026 - i);

function parsePeriod(str) {
  if (!str) return { sm: '', sy: '', em: '', ey: '', present: false };
  const parts = str.split(/\s*[–-]\s*/);
  const parseOne = (s) => {
    const m = s.match(/([A-Za-z]+)\s*(\d{4})/);
    if (m) return { m: m[1].slice(0, 3), y: m[2] };
    const y = s.match(/(\d{4})/);
    return { m: '', y: y?.[1] ?? '' };
  };
  const first = parseOne(parts[0] ?? '');
  const last = parseOne(parts[1] ?? '');
  const present = /presente?/i.test(parts[1] ?? '');
  return { sm: first.m, sy: first.y, em: last.m, ey: last.y, present };
}

function PeriodPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const p = parsePeriod(value);
  const [sm, setSm] = useState(p.sm);
  const [sy, setSy] = useState(p.sy);
  const [em, setEm] = useState(p.em);
  const [ey, setEy] = useState(p.ey);
  const [present, setPresent] = useState(p.present);

  const apply = () => {
    const start = sy ? `${sm ? sm + ' ' : ''}${sy}`.trim() : '';
    const end = present ? 'Present' : ey ? `${em ? em + ' ' : ''}${ey}`.trim() : '';
    const result = start && end ? `${start} – ${end}` : start || end;
    onChange(result);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="mt-5 shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
        onClick={() => setOpen(!open)}
        title="Seleccionar fecha"
      >
        📅
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-40 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-slate-600">Inicio</p>
          <div className="mb-3 flex gap-2">
            <select className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" value={sm} onChange={(e) => setSm(e.target.value)}>
              <option value="">Mes</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" value={sy} onChange={(e) => setSy(e.target.value)}>
              <option value="">Año</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Fin</p>
          <div className="mb-3 flex gap-2">
            <select className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" value={em} onChange={(e) => setEm(e.target.value)} disabled={present}>
              <option value="">Mes</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" value={ey} onChange={(e) => setEy(e.target.value)} disabled={present}>
              <option value="">Año</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={present} onChange={(e) => setPresent(e.target.checked)} className="rounded" />
            Presente / Present
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="button" className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700" onClick={apply}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          className={`${inputCls} resize-y`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputCls}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ListEditor({ items, fields, onChange, addLabel, onImprove }) {
  const setItem = (i, key, value) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Field
                      label={f.label}
                      value={item[f.key] ?? ''}
                      placeholder={f.placeholder}
                      textarea={f.textarea}
                      onChange={(v) => setItem(i, f.key, v)}
                    />
                  </div>
                  {f.periodField && (
                    <PeriodPicker
                      value={item[f.key] ?? ''}
                      onChange={(v) => setItem(i, f.key, v)}
                    />
                  )}
                  {f.improveable && onImprove && (
                    <button
                      className="mt-5 shrink-0 rounded-md border border-emerald-500 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      onClick={() => onImprove(i, f.key)}
                      title="Mejorar texto con IA"
                    >
                      ✨ Mejorar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            className="mt-2 text-xs font-medium text-red-600 hover:text-red-800"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            Eliminar
          </button>
        </div>
      ))}
      <button
        className="rounded-md border border-dashed border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        onClick={() => onChange([...items, Object.fromEntries(fields.map((f) => [f.key, '']))])}
      >
        + {addLabel}
      </button>
    </div>
  );
}

const TEMPLATE_OPTIONS = [
  { key: 'clasica', label: 'Clásica', desc: 'Estructura tradicional, sobria y legible' },
  { key: 'moderna', label: 'Moderna', desc: 'Acentos en verde esmeralda y secciones marcadas' },
  { key: 'minimal', label: 'Minimal', desc: 'Serif Times, espaciado amplio, sin ruido' },
  { key: 'sidebar', label: 'Sidebar', desc: 'Dos columnas con panel lateral oscuro', atsRisk: true }
];

function TemplatePreview({ t }) {
  if (t.key === 'clasica') {
    return (
      <div className="p-2">
        <div className="h-1.5 w-3/4 rounded bg-slate-800" />
        <div className="mt-1 h-1 w-1/2 rounded bg-slate-400" />
        <div className="mt-1.5 h-px bg-slate-300" />
        <div className="mt-1.5 h-1 w-full rounded bg-slate-300" />
        <div className="mt-1 h-1 w-full rounded bg-slate-200" />
        <div className="mt-1 h-1 w-2/3 rounded bg-slate-200" />
      </div>
    );
  }
  if (t.key === 'moderna') {
    return (
      <div className="p-2">
        <div className="h-1.5 w-2/3 rounded bg-emerald-700" />
        <div className="mt-1 h-1 w-1/2 rounded bg-slate-400" />
        <div className="mt-1.5 h-0.5 rounded bg-emerald-600" />
        <div className="mt-1.5 h-1 w-full rounded bg-slate-300" />
        <div className="mt-1 h-1 w-full rounded bg-slate-200" />
      </div>
    );
  }
  if (t.key === 'minimal') {
    return (
      <div className="p-2 font-serif">
        <div className="h-1.5 w-1/2 rounded bg-slate-700" />
        <div className="mt-1 h-1 w-1/3 rounded bg-slate-400" />
        <div className="mt-2 h-1 w-full rounded bg-slate-300" />
        <div className="mt-1 h-1 w-full rounded bg-slate-200" />
        <div className="mt-1 h-1 w-3/4 rounded bg-slate-200" />
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <div className="w-1/3 bg-slate-800 p-1.5">
        <div className="h-1 w-full rounded bg-slate-500" />
        <div className="mt-1 h-1 w-full rounded bg-slate-600" />
        <div className="mt-1 h-1 w-2/3 rounded bg-slate-600" />
      </div>
      <div className="flex-1 p-1.5">
        <div className="h-1.5 w-3/4 rounded bg-slate-700" />
        <div className="mt-1 h-1 w-1/2 rounded bg-slate-400" />
        <div className="mt-2 h-1 w-full rounded bg-slate-300" />
      </div>
    </div>
  );
}

function AtsPanel({ template, dirty, disabled }) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/cv/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error al verificar');
      setReport(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const scoreColor = report?.score >= 90 ? 'text-emerald-600' : report?.score >= 70 ? 'text-amber-600' : 'text-red-600';
  const barColor = report?.score >= 90 ? 'bg-emerald-500' : report?.score >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Compatibilidad ATS</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Genera el PDF y lo re-parsea como un ATS para detectar problemas de lectura.
          </p>
        </div>
        <button
          className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          onClick={run}
          disabled={busy || disabled}
        >
          {busy ? 'Verificando…' : 'Verificar'}
        </button>
      </div>

      {dirty && (
        <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-700">
          Se verifica el CV guardado en el servidor — guardá los cambios antes de verificar.
        </p>
      )}
      {error && <p className="mt-3 rounded bg-red-100 p-2 text-xs text-red-700">{error}</p>}

      {report && (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${scoreColor}`}>{report.score}</span>
            <span className="text-sm text-slate-500">/ 100</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${report.score}%` }} />
            </div>
          </div>
          <ul className="mt-4 space-y-1.5">
            {report.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                <span className={c.ok ? 'text-emerald-600' : 'text-red-500'}>{c.ok ? '✓' : '✗'}</span>
                <span className={c.ok ? 'text-slate-600' : 'text-red-700'}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CVPage() {
  const [cv, setCv] = useState(emptyCv);
  const [template, setTemplate] = useState('clasica');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [exportLang, setExportLang] = useState('es');
  const [extractingSkills, setExtractingSkills] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/cv');
      const body = await r.json();
      setCv({ ...emptyCv, ...body.data });
      setTemplate(body.template ?? 'clasica');
      setLoaded(true);
    } catch {
      setError('No se pudo conectar con la API');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const update = (patch) => { setCv((c) => ({ ...c, ...patch })); setDirty(true); };
  const updateField = (key) => (value) => update({ [key]: value });

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: cv, template })
      });
      if (!r.ok) throw new Error('Error al guardar');
      setDirty(false);
      notify('✓ CV guardado');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadPdf = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se aceptan archivos PDF');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/cv/upload', { method: 'POST', body: fd });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error al subir el PDF');
      setCv({ ...emptyCv, ...body.data });
      setDirty(false);
      notify(`✓ PDF procesado (${body.extractedChars} caracteres extraídos)`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/cv/export?template=${template}&lang=${exportLang}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? 'Error al exportar');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportLang === 'en' ? 'cv_EN.pdf' : 'cv.pdf';
      a.click();
      URL.revokeObjectURL(url);
      notify(`✓ PDF exportado${exportLang === 'en' ? ' (inglés)' : ''}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm('¿Borrar todo el CV y empezar de cero?')) return;
    setCv(emptyCv);
    setDirty(true);
  };

  const buildTasks = () => {
    const tasks = [];
    if (cv.resumen.trim()) {
      tasks.push({ listKey: 'resumen', index: null, fieldKey: 'resumen', value: cv.resumen, label: 'Resumen' });
    }
    cv.experiencia.forEach((e, i) => {
      if (e.descripcion?.trim()) {
        tasks.push({
          listKey: 'experiencia', index: i, fieldKey: 'descripcion', value: e.descripcion,
          label: `Experiencia ${i + 1} · ${e.titulo || 'Descripción'}`
        });
      }
    });
    cv.proyectos.forEach((p, i) => {
      if (p.descripcion?.trim()) {
        tasks.push({
          listKey: 'proyectos', index: i, fieldKey: 'descripcion', value: p.descripcion,
          label: `Proyecto ${i + 1} · ${p.titulo || 'Descripción'}`
        });
      }
    });
    return tasks;
  };

  const runImprove = async (task) => {
    setWizard((w) => ({ ...w, busy: true, error: '' }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100000);
    try {
      const r = await fetch('/api/cv/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: task.fieldKey, value: task.value }),
        signal: controller.signal
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error al mejorar');
      setWizard((w) => ({ ...w, busy: false, improved: body.improved }));
    } catch (e) {
      setWizard((w) => ({ ...w, busy: false, error: e.message }));
    } finally {
      clearTimeout(timer);
    }
  };

  const openWizard = (tasks) => {
    if (!tasks.length) return;
    setWizard({ tasks, idx: 0, improved: '', busy: false, error: '', approved: 0 });
    runImprove(tasks[0]);
  };

  const closeWizard = () => setWizard(null);

  const applyImproved = (task, improved) => {
    if (task.listKey === 'resumen') {
      setCv((c) => ({ ...c, resumen: improved }));
    } else {
      setCv((c) => {
        const list = [...c[task.listKey]];
        list[task.index] = { ...list[task.index], [task.fieldKey]: improved };
        return { ...c, [task.listKey]: list };
      });
    }
    setDirty(true);
  };

  const wizardNext = (approved) => {
    const w = wizard;
    if (!w) return;
    const nextIdx = w.idx + 1;
    const approvedTotal = w.approved + approved;
    if (nextIdx >= w.tasks.length) {
      setWizard(null);
      if (approvedTotal > 0) notify(`✓ ${approvedTotal} texto${approvedTotal === 1 ? '' : 's'} mejorado${approvedTotal === 1 ? '' : 's'}`);
      return;
    }
    setWizard({ ...w, idx: nextIdx, improved: '', busy: false, error: '', approved: approvedTotal });
    runImprove(w.tasks[nextIdx]);
  };

  const approveCurrent = () => {
    const w = wizard;
    if (!w || w.busy) return;
    const improved = w.improved.trim();
    if (!improved) return;
    applyImproved(w.tasks[w.idx], improved);
    wizardNext(1);
  };

  const skipCurrent = () => wizardNext(0);

  const improveResumen = () => openWizard(buildTasks().filter((t) => t.listKey === 'resumen'));

  const improveEntry = (listKey, index, fieldKey) =>
    openWizard(buildTasks().filter((t) => t.listKey === listKey && t.index === index && t.fieldKey === fieldKey));

  const improveAll = () => openWizard(buildTasks());

  const extractSkillsFromCv = async () => {
    setExtractingSkills(true);
    setError('');
    try {
      const r = await fetch('/api/cv/skills', { method: 'POST' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error al extraer skills');
      const existing = new Set(cv.skills.filter(Boolean).map((s) => s.toLowerCase()));
      const newSkills = body.skills.filter((s) => !existing.has(s.toLowerCase()));
      if (newSkills.length) {
        update({ skills: [...cv.skills.filter(Boolean), ...newSkills] });
        notify(`✓ ${newSkills.length} skill${newSkills.length === 1 ? '' : 's'} agregada${newSkills.length === 1 ? '' : 's'}`);
      } else {
        notify('No se encontraron skills nuevas');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setExtractingSkills(false);
    }
  };

  const isEmpty = !loaded || Object.values(cv).every((v) =>
    typeof v === 'string' ? v === '' : v.length === 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mi CV</h1>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Subir PDF
          </button>
          <div className="flex items-center rounded-md border border-slate-300">
            <button
              className={`px-3 py-2 text-xs font-medium transition ${exportLang === 'es' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setExportLang('es')}
            >
              ES
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium transition ${exportLang === 'en' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setExportLang('en')}
            >
              EN
            </button>
          </div>
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={exportPdf}
            disabled={busy || isEmpty}
          >
            {busy && exportLang === 'en' ? 'Traduciendo…' : 'Exportar PDF'}
          </button>
          {!isEmpty && (
            <button
              className="rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              onClick={improveAll}
            >
              ✨ Mejorar todo
            </button>
          )}
          {dirty && (
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={save}
              disabled={busy}
            >
              Guardar
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => { uploadPdf(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      {error && (
        <p className="flex items-center justify-between rounded bg-red-100 p-3 text-sm text-red-700">
          {error}
          <button className="font-bold" onClick={() => setError('')}>×</button>
        </p>
      )}
      {toast && <p className="rounded bg-emerald-100 p-3 text-sm text-emerald-700">{toast}</p>}

      {isEmpty ? (
        <div
          className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition ${
            dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:border-emerald-400'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            uploadPdf(e.dataTransfer.files?.[0]);
          }}
        >
          <p className="text-lg font-medium text-slate-600">Subí tu CV en PDF</p>
          <p className="mt-1 text-sm text-slate-400">
            Arrastrá el archivo acá o hacé clic. Se extraen los datos y quedan listos para editar.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Plantilla de exportación</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  className={`relative rounded-lg border-2 p-3 text-left transition ${
                    template === t.key
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => { setTemplate(t.key); setDirty(true); }}
                >
                  <div className="h-20 overflow-hidden rounded border border-slate-200 bg-white">
                    <TemplatePreview t={t} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{t.label}</p>
                  <p className="text-xs text-slate-400">{t.desc}</p>
                  {t.atsRisk && (
                    <span className="mt-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      ⚠ Riesgo ATS
                    </span>
                  )}
                  {template === t.key && (
                    <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Seleccionada
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <AtsPanel template={template} dirty={dirty} disabled={isEmpty || busy} />

          <div className="grid gap-3 rounded-lg bg-white p-5 shadow-sm sm:grid-cols-2">
            <Field label="Nombre" value={cv.nombre} onChange={updateField('nombre')} placeholder="Nombre y apellido" />
            <Field label="Título profesional" value={cv.titulo} onChange={updateField('titulo')} placeholder="Ej: Desarrollador Full Stack" />
            <Field label="Email" value={cv.email} onChange={updateField('email')} placeholder="tu@email.com" />
            <Field label="Teléfono" value={cv.telefono} onChange={updateField('telefono')} placeholder="+54 11 0000-0000" />
            <Field label="Ubicación" value={cv.ubicacion} onChange={updateField('ubicacion')} placeholder="Ciudad, País" />
            <Field label="LinkedIn" value={cv.linkedin} onChange={updateField('linkedin')} placeholder="linkedin.com/in/..." />
            <div className="sm:col-span-2">
              <Field label="Web / Portfolio" value={cv.web} onChange={updateField('web')} placeholder="https://..." />
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Resumen</h2>
              <button
                className="shrink-0 rounded-md border border-emerald-500 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                onClick={improveResumen}
                disabled={!cv.resumen.trim()}
              >
                ✨ Mejorar
              </button>
            </div>
            <Field textarea value={cv.resumen} onChange={updateField('resumen')} placeholder="Resumen profesional en 3-4 líneas" />
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Experiencia</h2>
            <ListEditor
              items={cv.experiencia}
              fields={[
                { key: 'titulo', label: 'Puesto', placeholder: 'Ej: Desarrollador Frontend' },
                { key: 'entidad', label: 'Empresa', placeholder: 'Ej: Acme S.A.' },
                { key: 'periodo', label: 'Período', placeholder: '2021 – 2024', periodField: true },
                { key: 'descripcion', label: 'Descripción', placeholder: 'Responsabilidades y logros', textarea: true, full: true, improveable: true }
              ]}
              onChange={(experiencia) => update({ experiencia })}
              onImprove={(i, key) => improveEntry('experiencia', i, key)}
              addLabel="Agregar experiencia"
            />
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Educación</h2>
            <ListEditor
              items={cv.educacion}
              fields={[
                { key: 'titulo', label: 'Título', placeholder: 'Ej: Lic. en Sistemas' },
                { key: 'entidad', label: 'Institución', placeholder: 'Ej: UBA' },
                { key: 'periodo', label: 'Período', placeholder: '2015 – 2020', periodField: true }
              ]}
              onChange={(educacion) => update({ educacion })}
              addLabel="Agregar educación"
            />
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Skills</h2>
              <button
                className="shrink-0 rounded-md border border-emerald-500 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                onClick={extractSkillsFromCv}
                disabled={extractingSkills || isEmpty}
              >
                {extractingSkills ? 'Extrayendo…' : '✨ Extraer skills'}
              </button>
            </div>
            <textarea
              rows={4}
              className={`${inputCls} resize-y font-mono text-xs`}
              value={cv.skills.join('\n')}
              placeholder={'Una skill por línea\nEj:\nReact\nNode.js\nTypeScript'}
              onChange={(e) => update({ skills: e.target.value.split('\n') })}
            />
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Idiomas</h2>
            <ListEditor
              items={cv.idiomas}
              fields={[
                { key: 'idioma', label: 'Idioma', placeholder: 'Ej: Inglés' },
                { key: 'nivel', label: 'Nivel', placeholder: 'Ej: Avanzado (C1)' }
              ]}
              onChange={(idiomas) => update({ idiomas })}
              addLabel="Agregar idioma"
            />
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Proyectos</h2>
            <ListEditor
              items={cv.proyectos}
              fields={[
                { key: 'titulo', label: 'Nombre', placeholder: 'Ej: E-commerce API' },
                { key: 'entidad', label: 'Rol / Detalle', placeholder: 'Ej: Desarrollador principal' },
                { key: 'periodo', label: 'Período', placeholder: '2023', periodField: true },
                { key: 'link', label: 'Link', placeholder: 'https://...', full: true },
                { key: 'descripcion', label: 'Descripción', placeholder: 'Qué hace y qué usaste', textarea: true, full: true, improveable: true }
              ]}
              onChange={(proyectos) => update({ proyectos })}
              onImprove={(i, key) => improveEntry('proyectos', i, key)}
              addLabel="Agregar proyecto"
            />
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Certificaciones</h2>
            <textarea
              rows={3}
              className={`${inputCls} resize-y`}
              value={cv.certificaciones.join('\n')}
              placeholder={'Una por línea\nEj:\nAWS Certified Solutions Architect\nScrum Master'}
              onChange={(e) => update({ certificaciones: e.target.value.split('\n').filter(Boolean) })}
            />
          </div>

          <div className="flex justify-between">
            <button className="text-xs font-medium text-red-600 hover:text-red-800" onClick={reset}>
              Empezar de cero
            </button>
            {dirty && (
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                onClick={save}
              >
                Guardar cambios
              </button>
            )}
          </div>
        </div>
      )}

      {wizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">✨ Mejorar con IA</h3>
                <p className="text-xs text-slate-400">
                  {wizard.tasks[wizard.idx].label}
                  {wizard.tasks.length > 1 && ` · ${wizard.idx + 1} de ${wizard.tasks.length}`}
                </p>
              </div>
              <button className="text-slate-400 hover:text-slate-600" onClick={closeWizard} title="Cerrar">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {wizard.error && (
                <div className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-700">
                  {wizard.error}
                  <a className="ml-1 font-semibold underline" href="/configuracion">Ir a Configuración</a>
                </div>
              )}
              <p className="mb-1 text-xs font-medium text-slate-500">Original</p>
              <div className="mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                {wizard.tasks[wizard.idx].value}
              </div>
              <p className="mb-1 text-xs font-medium text-slate-500">
                Mejorado {wizard.busy && <span className="text-emerald-600">(generando…)</span>}
              </p>
              {wizard.busy ? (
                <div className="flex items-center justify-center gap-2 rounded-md border border-slate-200 py-10 text-sm text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  Generando con IA… puede tardar unos segundos
                </div>
              ) : (
                <textarea
                  rows={8}
                  className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={wizard.improved}
                  onChange={(e) => setWizard((w) => ({ ...w, improved: e.target.value }))}
                  placeholder="El texto mejorado aparece acá; podés editarlo antes de aprobar."
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
              <div className="flex gap-2">
                {wizard.error && (
                  <button
                    className="rounded-md border border-amber-500 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                    onClick={() => runImprove(wizard.tasks[wizard.idx])}
                  >
                    ↻ Reintentar
                  </button>
                )}
                {wizard.tasks.length > 1 && !wizard.busy && !wizard.error && (
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                    onClick={skipCurrent}
                  >
                    Saltar
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={closeWizard}
                >
                  Salir
                </button>
                <button
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  onClick={approveCurrent}
                  disabled={wizard.busy || !wizard.improved.trim()}
                >
                  {wizard.tasks.length > 1 ? '✓ Aprobar y seguir' : '✓ Aprobar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}