import { NavLink, Route, Routes } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">🌾 Trabajo Farmer</span>
          </div>
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