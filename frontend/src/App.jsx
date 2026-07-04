import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useEcheancia } from './hooks/useEcheancia.js';
import { api } from './api/client.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NuevaFactura from './pages/NuevaFactura.jsx';
import ListaFacturas from './pages/ListaFacturas.jsx';
import Formulario110 from './pages/Formulario110.jsx';
import Invitaciones from './pages/Invitaciones.jsx';
import ClientesPortafolio from './pages/ClientesPortafolio.jsx';
import ClienteDetalle from './pages/ClienteDetalle.jsx';
import Mensajes from './pages/Mensajes.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

/* ─── SVG Icons ─────────────────────────────────────────────── */
const IconHome = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconDocs = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconClipboard = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconUserCheck = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <polyline points="16 11 18 13 22 9"/>
  </svg>
);

/* ─── Notification badge ────────────────────────────────────── */
function NavBadge({ nit }) {
  const { nivel } = useEcheancia(nit);
  if (nivel === 'ok') return null;
  const urgent = nivel === 'urgente' || nivel === 'vencido';
  return (
    <span
      className={urgent ? 'badge-pulse' : ''}
      style={{
        position:     'absolute',
        top:          6,
        right:        '18%',
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   nivel === 'alerta' ? 'var(--oro)' : 'var(--rojo)',
        border:       '1.5px solid var(--surface)',
      }}
    />
  );
}

/* ─── Client selector (header — comptable view) ─────────────── */
function ClientSelector({ clienteActivo, setClienteActivo, clientes }) {
  const navigate = useNavigate();
  if (!clientes.length) return null;

  return (
    <div className="client-selector">
      <span className="client-selector-label">Cliente:</span>
      <select
        className="client-selector-select"
        value={clienteActivo?.id ?? ''}
        onChange={(e) => {
          const found = clientes.find((c) => String(c.id) === e.target.value);
          setClienteActivo(found || null);
          if (found) navigate(`/cliente/${found.id}`);
        }}
      >
        <option value="">— Todos —</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre.split(' ')[0]}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Layout ─────────────────────────────────────────────────── */
function Layout({ children }) {
  const { user, logout, esContador, esIndependiente } = useAuth();
  const inicial      = user?.nombre?.charAt(0).toUpperCase() ?? '?';
  const primerNombre = user?.nombre?.split(' ')[0] ?? '';
  const cls          = ({ isActive }) => (isActive ? 'active' : '');

  // Estado del cliente activo (solo para contadores)
  const [clientes, setClientes]           = useState([]);
  const [clienteActivo, setClienteActivo] = useState(null);

  useEffect(() => {
    if (!esContador) return;
    api.get('/clientes')
      .then((data) => {
        setClientes(data);
        if (data.length === 1) setClienteActivo(data[0]);
      })
      .catch(() => {});
  }, [esContador]);

  // Label de la pestaña Form según tipo
  const labelForm = esIndependiente ? 'Form 610' : 'Form 110';

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="brand-icon">🧾</div>
          <span className="brand-name">ImpuestosBO</span>
        </div>

        <div className="header-right">
          {/* Sélecteur de client pour le comptable */}
          {esContador && (
            <ClientSelector
              clienteActivo={clienteActivo}
              setClienteActivo={setClienteActivo}
              clientes={clientes}
            />
          )}
          <button className="user-btn" onClick={logout} title="Cerrar sesión">
            <div className="user-avatar">{inicial}</div>
            <span className="user-name">{primerNombre}</span>
          </button>
        </div>
      </header>

      <main>{children}</main>

      {/* ─── Barre de navigation unifiée ──────────────────── */}
      <nav className="tabs">
        <NavLink to="/" end className={cls} style={{ position: 'relative' }}>
          {esContador ? <IconUsers /> : <IconHome />}
          {esContador ? 'Clientes' : 'Inicio'}
          {!esContador && <NavBadge nit={user?.nit} />}
        </NavLink>

        <NavLink to="/facturas" className={cls}>
          <IconDocs />
          Facturas
        </NavLink>

        <NavLink to="/form110" className={cls}>
          <IconClipboard />
          {labelForm}
        </NavLink>

        <NavLink to="/mensajes" className={cls}>
          <IconChat />
          Mensajes
        </NavLink>

        <NavLink to={esContador ? '/admin' : '/invitar'} className={cls}>
          {esContador ? <IconShield /> : <IconUserCheck />}
          {esContador ? 'Admin' : 'Contador'}
        </NavLink>
      </nav>
    </div>
  );
}

/* ─── App root ───────────────────────────────────────────────── */
export default function App() {
  const { isAuth, user, esContador } = useAuth();

  if (!isAuth) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        {/* Routes communes */}
        <Route path="/mensajes"      element={<Mensajes />} />
        <Route path="/facturas"      element={<ListaFacturas />} />
        <Route path="/form110"       element={<Formulario110 />} />

        {esContador ? (
          <>
            <Route path="/"             element={<ClientesPortafolio />} />
            <Route path="/cliente/:id"  element={<ClienteDetalle />} />
            <Route path="/invitar"      element={<Invitaciones />} />
            <Route path="/admin"        element={<AdminDashboard />} />
          </>
        ) : (
          <>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/nueva-factura" element={<NuevaFactura />} />
            <Route path="/invitar"       element={<Invitaciones />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
