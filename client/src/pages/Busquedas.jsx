import { useCallback, useEffect, useState } from 'react';

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

const EXPERIENCE_LEVELS = [
  { value: '1', label: 'Pasantía' },
  { value: '2', label: 'Junior' },
  { value: '3', label: 'Associate' },
  { value: '4', label: 'Mid-Senior' },
  { value: '5', label: 'Director' },
  { value: '6', label: 'Executive' }
];
const JOB_TYPES = [
  { value: 'F', label: 'Tiempo completo' },
  { value: 'P', label: 'Part-time' },
  { value: 'C', label: 'Contrato' },
  { value: 'T', label: 'Temporal' },
  { value: 'I', label: 'Pasantía' }
];
const WORK_TYPES = [
  { value: '1', label: 'Presencial' },
  { value: '2', label: 'Remoto' },
  { value: '3', label: 'Híbrido' }
];
const CONTINENTS = [
  { value: 'Europa', label: 'Europa' },
  { value: 'Norteamérica', label: 'Norteamérica' },
  { value: 'Sudamérica', label: 'Sudamérica' },
  { value: 'Asia', label: 'Asia' }
];
const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'ES', label: 'España' },
  { value: 'MX', label: 'México' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CL', label: 'Chile' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Perú' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CA', label: 'Canadá' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'DE', label: 'Alemania' },
  { value: 'FR', label: 'Francia' },
  { value: 'PT', label: 'Portugal' },
  { value: 'NL', label: 'Países Bajos' },
  { value: 'IE', label: 'Irlanda' },
  { value: 'IT', label: 'Italia' },
  { value: 'IN', label: 'India' },
  { value: 'SG', label: 'Singapur' }
];
const CONTINENT_COUNTRIES = {
  Europa: ['ES', 'GB', 'DE', 'FR', 'PT', 'NL', 'IE', 'IT'],
  Norteamérica: ['US', 'CA', 'MX'],
  Sudamérica: ['AR', 'BR', 'CL', 'UY', 'CO', 'PE'],
  Asia: ['IN', 'SG']
};
const TIME_POSTED = [
  { value: '', label: 'Cualquier fecha' },
  { value: 'r86400', label: 'Últimas 24 hs' },
  { value: 'r604800', label: 'Última semana' },
  { value: 'r2592000', label: 'Último mes' }
];

const emptyDraft = {
  name: '', keywords: '', location: '', geoId: '',
  experienceLevels: [], jobTypes: [], workTypes: [], countries: [], timePosted: '', companyId: '', active: true
};

function MultiCheck({ options, values, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500 hover:border-slate-400'
            }`}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BusquedasPage() {
  const [searches, setSearches] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/searches');
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error');
      setSearches(body);
    } catch {
      setError('No se pudo conectar con la API');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const saveSearch = async () => {
    if (!draft.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError('');
    setBusy('form');
    try {
      const url = editingId ? `/api/searches/${editingId}` : '/api/searches';
      const r = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error al guardar');
      notify(editingId ? '✓ Búsqueda actualizada' : '✓ Búsqueda creada');
      setDraft(emptyDraft);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const editSearch = (s) => {
    setEditingId(s.id);
    setDraft({
      name: s.name, keywords: s.keywords, location: s.location, geoId: s.geo_id,
      experienceLevels: s.experienceLevels, jobTypes: s.jobTypes, workTypes: s.workTypes, countries: s.countries,
      timePosted: s.time_posted, companyId: s.company_id, active: s.active
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleContinent = (continent) => {
    const codes = CONTINENT_COUNTRIES[continent.value] ?? [];
    const on = codes.every((c) => draft.countries.includes(c));
    const countries = on
      ? draft.countries.filter((c) => !codes.includes(c))
      : [...new Set([...draft.countries, ...codes])];
    setDraft({ ...draft, countries });
  };

  const removeSearch = async (s) => {
    if (!confirm(`¿Eliminar la búsqueda "${s.name}"?`)) return;
    await fetch(`/api/searches/${s.id}`, { method: 'DELETE' });
    load();
  };

  const fetchSearch = async (s) => {
    setBusy(s.id);
    setError('');
    try {
      const r = await fetch('/api/jobs/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchId: s.id })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error');
      notify(`✓ ${body.fetched} ofertas (${body.new} nuevas) para "${s.name}"`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (s) => {
    await fetch(`/api/searches/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, active: !s.active })
    });
    load();
  };

  const filterSummary = (s) => {
    const parts = [];
    if (s.keywords) parts.push(s.keywords);
    if (s.location) parts.push(s.location);
    if (s.countries?.length) {
      const labels = COUNTRIES.filter((o) => s.countries.includes(o.value)).map((o) => o.label);
      parts.push(labels.join(', '));
    }
    if (s.experienceLevels.length) {
      const labels = EXPERIENCE_LEVELS.filter((o) => s.experienceLevels.includes(o.value)).map((o) => o.label);
      parts.push(labels.join(', '));
    }
    if (s.jobTypes.length) parts.push('Tipos: ' + s.jobTypes.length);
    if (s.workTypes.length) {
      const labels = WORK_TYPES.filter((o) => s.workTypes.includes(o.value)).map((o) => o.label);
      parts.push('Modalidad: ' + labels.join(', '));
    }
    const tp = TIME_POSTED.find((o) => o.value === s.time_posted);
    if (tp && tp.value) parts.push(tp.label);
    return parts.join(' · ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Búsquedas</h1>
        <button
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          onClick={() => { setShowForm(!showForm); setEditingId(null); setDraft(emptyDraft); setError(''); }}
        >
          {showForm && !editingId ? 'Cancelar' : '+ Nueva búsqueda'}
        </button>
      </div>

      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
      {toast && <p className="rounded bg-emerald-100 p-3 text-sm text-emerald-700">{toast}</p>}

      {showForm && (
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {editingId ? 'Editar búsqueda' : 'Nueva búsqueda'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Nombre *</span>
              <input className={inputCls} value={draft.name} placeholder="Ej: QA en Argentina"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Ubicación</span>
              <input className={inputCls} value={draft.location} placeholder="Ej: Buenos Aires, Argentina"
                onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Palabras clave</span>
              <input className={inputCls} value={draft.keywords} placeholder="Ej: qa tester automation"
                onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} />
              <span className="mt-1 block text-[11px] text-slate-400">Separar con espacios, ej: qa tester automation</span>
            </label>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Nivel de experiencia</span>
              <MultiCheck options={EXPERIENCE_LEVELS} values={draft.experienceLevels}
                onChange={(experienceLevels) => setDraft({ ...draft, experienceLevels })} />
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Tipo de empleo</span>
              <MultiCheck options={JOB_TYPES} values={draft.jobTypes}
                onChange={(jobTypes) => setDraft({ ...draft, jobTypes })} />
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Países / Continentes</span>
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {CONTINENTS.map((c) => {
                  const codes = CONTINENT_COUNTRIES[c.value];
                  const on = codes.every((cc) => draft.countries.includes(cc));
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500 hover:border-slate-400'
                      }`}
                      onClick={() => toggleContinent(c)}
                    >
                      {on ? '✓ ' : ''}{c.label}
                    </button>
                  );
                })}
              </div>
              <MultiCheck options={COUNTRIES} values={draft.countries}
                onChange={(countries) => setDraft({ ...draft, countries })} />
              <p className="mt-1 text-[11px] text-slate-400">
                Sugerencia: Argentina → híbrido, resto del mundo → remoto (automático). Elegí modalidad manual para anularlo.
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Modalidad</span>
              <MultiCheck options={WORK_TYPES} values={draft.workTypes}
                onChange={(workTypes) => setDraft({ ...draft, workTypes })} />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Publicado</span>
              <select className={inputCls} value={draft.timePosted}
                onChange={(e) => setDraft({ ...draft, timePosted: e.target.value })}>
                {TIME_POSTED.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Empresa (ID de LinkedIn, opcional)</span>
              <input className={inputCls} value={draft.companyId} placeholder="Ej: 1035"
                onChange={(e) => setDraft({ ...draft, companyId: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Activa
            </label>
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={saveSearch}
              disabled={busy === 'form'}
            >
              {busy === 'form' ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear búsqueda'}
            </button>
          </div>
        </div>
      )}

      {searches.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg text-slate-500">Todavía no hay búsquedas</p>
          <p className="mt-1 text-sm text-slate-400">
            Creá una búsqueda con keywords y filtros para rastrear ofertas de LinkedIn.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {searches.map((s) => (
          <div key={s.id} className={`rounded-lg bg-white p-5 shadow-sm ${s.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-800">{s.name}</h2>
                  {!s.active && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">INACTIVA</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{filterSummary(s)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  onClick={() => fetchSearch(s)}
                  disabled={busy === s.id || !s.active}
                >
                  {busy === s.id ? 'Trayendo…' : '⟳ Traer ofertas'}
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => editSearch(s)}
                >
                  Editar
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  onClick={() => toggleActive(s)}
                  title={s.active ? 'Desactivar' : 'Activar'}
                >
                  {s.active ? 'Pausar' : 'Activar'}
                </button>
                <button
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  onClick={() => removeSearch(s)}
                >
                  Eliminar
                </button>
              </div>
            </div>
            {s.last_run_at && (
              <p className="mt-2 text-[11px] text-slate-400">Última ejecución: {s.last_run_at.replace('T', ' ').slice(0, 16)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}