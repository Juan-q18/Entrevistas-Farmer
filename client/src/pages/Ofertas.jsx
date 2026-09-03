import { useCallback, useEffect, useState } from 'react';
import api from '../api.js';

const STATUSES = [
  { value: 'nueva', label: 'Nueva', cls: 'border-slate-300 text-slate-600' },
  { value: 'interesante', label: 'Interesante', cls: 'border-sky-300 text-sky-700' },
  { value: 'aplicada', label: 'Aplicada', cls: 'border-emerald-300 text-emerald-700' },
  { value: 'descartada', label: 'Descartada', cls: 'border-red-300 text-red-600' }
];

const STATUS_BADGE = {
  nueva: 'bg-slate-100 text-slate-600',
  interesante: 'bg-sky-100 text-sky-700',
  aplicada: 'bg-emerald-100 text-emerald-700',
  descartada: 'bg-red-100 text-red-600'
};

function Highlight({ text, q }) {
  const terms = q.trim().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) {
    return <p className="whitespace-pre-wrap text-sm text-slate-600">{text}</p>;
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${terms.map(esc).join('|')})`, 'gi'));
  return (
    <p className="whitespace-pre-wrap text-sm text-slate-600">
      {parts.map((p, i) =>
        i % 2 === 1 ? <mark key={i} className="rounded bg-yellow-200 px-0.5">{p}</mark> : <span key={i}>{p}</span>
      )}
    </p>
  );
}

export default function OfertasPage() {
  const [allJobs, setAllJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('todas');
  const [countryFilter, setCountryFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [notesId, setNotesId] = useState(null);
  const [notes, setNotes] = useState('');
  const [descId, setDescId] = useState(null);
  const [descs, setDescs] = useState({});
  const [descErr, setDescErr] = useState({});

  const load = useCallback(async () => {
    try {
      const r = await api('/api/jobs');
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error');
      setAllJobs(body);
    } catch {
      setError('No se pudo conectar con la API');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const matchesQ = (j) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (j.title + ' ' + (j.company ?? '') + ' ' + (j.location ?? '')).toLowerCase().includes(t);
  };

  const countries = [...new Set(allJobs.map((j) => j.country).filter(Boolean))].sort();
  const langs = [...new Set(allJobs.map((j) => j.language).filter(Boolean))].sort();

  const qAll = allJobs.filter(matchesQ)
    .filter((j) => !countryFilter || j.country === countryFilter)
    .filter((j) => !langFilter || j.language === langFilter)
    .filter((j) => !remoteOnly || j.remote === 1);
  const jobs = qAll.filter((j) => statusFilter === 'todas' || j.status === statusFilter);
  const count = (status) => (status === 'todas' ? qAll.length : qAll.filter((j) => j.status === status).length);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const setStatus = async (job, status) => {
    await api(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    notify(`Marcada como "${STATUSES.find((s) => s.value === status).label}"`);
    load();
  };

  const saveNotes = async (job) => {
    await api(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    setNotesId(null);
    setNotes('');
    notify('✓ Nota guardada');
    load();
  };

  const loadDesc = async (job) => {
    setDescId(job.id);
    setDescErr((e) => ({ ...e, [job.id]: '' }));
    try {
      const r = await api(`/api/jobs/${job.id}/description`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error');
      setDescs((d) => ({ ...d, [job.id]: body.description }));
    } catch (e) {
      setDescErr((e2) => ({ ...e2, [job.id]: e.message }));
    } finally {
      setDescId(null);
    }
  };

  const toggleDesc = (job) => {
    if (descId === job.id) return;
    if (descs[job.id] || descErr[job.id]) {
      setDescs((d) => { const n = { ...d }; delete n[job.id]; return n; });
      setDescErr((e) => { const n = { ...e }; delete n[job.id]; return n; });
    } else {
      loadDesc(job);
    }
  };

  const refreshAll = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/searches');
      const searches = await r.json();
      const active = searches.filter((s) => s.active);
      let total = 0;
      for (const s of active) {
        const f = await api('/api/jobs/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchId: s.id })
        });
        const body = await f.json();
        if (f.status === 429) {
          setError(`LinkedIn te bloqueó al procesar "${s.name}". Se trajeron ${total} ofertas antes del bloqueo. Esperá unos minutos y volvé a intentar.`);
          load();
          return;
        }
        if (!f.ok) throw new Error(body.error ?? 'Error');
        total += body.fetched;
        if (body.truncated) setError(`Alguna búsqueda se limitó a ${body.truncated} países por ejecución — volvé a actualizar para el resto.`);
      }
      notify(`✓ ${total} ofertas traídas de ${active.length} búsqueda(s)`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ofertas</h1>
        <div className="flex gap-2">
          <input
            className="w-56 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Buscar por título, empresa…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={refreshAll}
            disabled={busy}
          >
            {busy ? 'Actualizando…' : '⟳ Actualizar ofertas'}
          </button>
          <button
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={async () => {
              if (!confirm('Esto eliminará TODAS las búsquedas y ofertas. Esta acción no se puede deshacer.\n\n¿Continuar?')) return;
              setBusy(true);
              try {
      await api('/api/searches', { method: 'DELETE' });
      setAllJobs([]);
      setToast('Todas las búsquedas y ofertas eliminadas');
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            🗑 Borrar todo
          </button>
        </div>
      </div>

      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
      {toast && <p className="rounded bg-emerald-100 p-3 text-sm text-emerald-700">{toast}</p>}

      <div className="flex flex-wrap gap-1.5">
        <button
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            statusFilter === 'todas' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'
          }`}
          onClick={() => setStatusFilter('todas')}
        >
          Todas ({count('todas')})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === s.value ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'
            }`}
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label} ({count(s.value)})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="">Todos los países</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
        >
          <option value="">Todos los idiomas</option>
          {langs.map((l) => (
            <option key={l} value={l}>{l === 'es' ? 'Español' : l === 'en' ? 'Inglés' : l}</option>
          ))}
        </select>
        <button
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            remoteOnly ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'
          }`}
          onClick={() => setRemoteOnly(!remoteOnly)}
        >
          🌍 Full remoto
        </button>
      </div>

      {jobs.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg text-slate-500">No hay ofertas {statusFilter !== 'todas' ? 'con este estado' : ''}</p>
          <p className="mt-1 text-sm text-slate-400">
            Andá a <span className="font-semibold">Búsquedas</span> y presioná "Traer ofertas" para rastrear LinkedIn.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className={`rounded-lg bg-white p-5 shadow-sm ${job.status === 'descartada' ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base font-semibold text-slate-800 hover:text-emerald-700 hover:underline"
                >
                  {job.title}
                </a>
                <p className="mt-0.5 text-sm text-slate-500">
                  {job.company}
                  {job.location && <span className="text-slate-400"> · {job.location}</span>}
                  {job.posted_date && <span className="text-slate-400"> · {job.posted_date}</span>}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[job.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUSES.find((s) => s.value === job.status)?.label ?? job.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                    job.status === s.value ? s.cls + ' bg-opacity-10' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                  }`}
                  disabled={job.status === s.value}
                  onClick={() => setStatus(job, s.value)}
                >
                  {s.label}
                </button>
              ))}
              <div className="ml-auto flex gap-1.5">
                <button
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setNotesId(notesId === job.id ? null : job.id);
                    setNotes(job.notes);
                  }}
                >
                  {notesId === job.id ? 'Cerrar' : job.notes ? '✎ Editar nota' : '✎ Nota'}
                </button>
                <button
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => toggleDesc(job)}
                  disabled={descId === job.id}
                >
                  {descId === job.id ? 'Cargando…' : descs[job.id] || descErr[job.id] ? 'Ocultar descripción' : '📄 Descripción'}
                </button>
              </div>
            </div>

            {(descs[job.id] || descErr[job.id]) && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                {descErr[job.id] ? (
                  <div className="text-sm text-red-600">
                    {descErr[job.id]}
                    <button className="ml-2 font-semibold underline" onClick={() => loadDesc(job)}>Reintentar</button>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-semibold text-slate-500">Descripción del puesto</p>
                    <Highlight text={descs[job.id]} q={q} />
                  </>
                )}
              </div>
            )}

            {notesId === job.id && (
              <div className="mt-3 flex gap-2">
                <textarea
                  rows={2}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Notas: salario, contacto, fecha de entrevista…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button
                  className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  onClick={() => saveNotes(job)}
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}