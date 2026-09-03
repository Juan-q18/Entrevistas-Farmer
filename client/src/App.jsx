import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import LoginPage from './pages/Login.jsx';
import CVPage from './pages/CV.jsx';
import BusquedasPage from './pages/Busquedas.jsx';
import OfertasPage from './pages/Ofertas.jsx';
import ConfiguracionPage from './pages/Configuracion.jsx';

const links = [
  { to: '/', label: 'CV', end: true },
  { to: '/busquedas', label: 'Búsquedas' },
  { to: '/ofertas', label: 'Ofertas' },
  { to: '/configuracion', label: 'Configuración' }
];

function Layout() {
  const { token, user, logout } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">🌾 Trabajo Farmer</span>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
              <span className="max-w-40 truncate text-xs text-slate-300">{user?.email}</span>
              <button className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                onClick={logout}>
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<CVPage />} />
          <Route path="/busquedas" element={<BusquedasPage />} />
          <Route path="/ofertas" element={<OfertasPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  );
}