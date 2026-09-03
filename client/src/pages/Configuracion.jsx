import { useCallback, useEffect, useState } from 'react';
import api from '../api.js';

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState(null);
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api('/api/settings');
      const body = await r.json();
      setSettings(body);
      setProvider(body.provider);
      setModel(body.model);
      setBaseUrl(body.baseUrl || body.providers[body.provider]?.baseUrl || '');
    } catch {
      setError('No se pudo conectar con la API');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!settings) {
    return <p className="text-sm text-slate-500">Cargando…</p>;
  }

  const providers = settings.providers;
  const selected = providers[provider];

  const changeProvider = (key) => {
    setProvider(key);
    const p = providers[key];
    setModel(p.defaultModel);
    setBaseUrl(p.baseUrl);
    setTestResult(null);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, baseUrl, apiKey })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error al guardar');
      setApiKey('');
      setSettings(body);
      setSaved('✓ Configuración guardada');
      setTimeout(() => setSaved(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setError('');
    setTestResult(null);
    try {
      const r = await api('/api/ai/test', { method: 'POST' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Error');
      setTestResult({ ok: true, msg: '✓ Conexión exitosa: el proveedor respondió OK' });
    } catch (e) {
      setTestResult({ ok: false, msg: '✗ ' + e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Mejorador de texto con IA</h2>
        <p className="mt-1 text-xs text-slate-400">
          Se usa para pulir el resumen y las descripciones del CV: mejora la redacción con tono profesional
          sin inventar datos. Es compatible con cualquier proveedor estilo OpenAI.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Proveedor</span>
            <select
              className={inputCls}
              value={provider}
              onChange={(e) => changeProvider(e.target.value)}
            >
              {Object.entries(providers).map(([key, p]) => (
                <option key={key} value={key}>{p.label}{p.noKey ? ' (sin key)' : ''}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Modelo</span>
            <input
              className={inputCls}
              value={model}
              placeholder={selected?.defaultModel ?? 'nombre-del-modelo'}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">URL base (API)</span>
            <input
              className={inputCls}
              value={baseUrl}
              placeholder={selected?.baseUrl ?? 'https://...'}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              API key {settings.hasKey && <span className="text-emerald-600">({settings.keyPreview} guardada — dejá en blanco para no cambiarla)</span>}
            </span>
            <input
              type="password"
              className={inputCls}
              value={apiKey}
              placeholder={selected?.noKey ? 'No es necesaria para este proveedor' : 'sk-...'}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
        </div>

        {selected?.noKey && (
          <p className="mt-3 rounded bg-sky-50 p-2 text-xs text-sky-700">
            Ollama corre local y gratis. Necesitás tener el modelo descargado: <code className="font-mono">ollama pull llama3.2</code>
          </p>
        )}

        {error && <p className="mt-3 rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
        {saved && <p className="mt-3 rounded bg-emerald-100 p-2 text-sm text-emerald-700">{saved}</p>}
        {testResult && (
          <p className={`mt-3 rounded p-2 text-sm ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {testResult.msg}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={test}
            disabled={busy}
          >
            {busy ? 'Probando…' : 'Probar conexión'}
          </button>
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={save}
            disabled={busy}
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-lg text-slate-500">Próximamente</p>
        <p className="mt-1 text-sm text-slate-400">
          Envío por email del listado de ofertas guardadas.
        </p>
      </div>
    </div>
  );
}