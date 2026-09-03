import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        const r = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name })
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Error al registrarse');
        setMode('login');
        setError('Cuenta creada. Iniciá sesión.');
      } else {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Error al iniciar sesión');
        login(body.token, body.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-slate-800">🌾 Trabajo Farmer</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          {mode === 'login' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <input className={inputCls} placeholder="Nombre (opcional)" value={name}
              onChange={(e) => setName(e.target.value)} />
          )}
          <input className={inputCls} type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input className={inputCls} type="password" placeholder="Contraseña" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>¿No tenés cuenta? <button className="font-semibold text-emerald-600 hover:underline"
              onClick={() => { setMode('register'); setError(''); }}>Registrate</button></>
          ) : (
            <>¿Ya tenés cuenta? <button className="font-semibold text-emerald-600 hover:underline"
              onClick={() => { setMode('login'); setError(''); }}>Iniciar sesión</button></>
          )}
        </p>
      </div>
    </div>
  );
}