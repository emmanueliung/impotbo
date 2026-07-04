import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Invitaciones() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [recibidas, setRecibidas] = useState([]);
  const [contadores, setContadores] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function cargar() {
    try {
      setRecibidas(await api.get('/invitations/recibidas'));
      if (user.rol === 'particular') {
        setContadores(await api.get('/clientes/mis/contadores'));
      }
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function invitar(e) {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const r = await api.post('/invitations', { destinatarioEmail: email });
      if (r.tieneCuenta) {
        setMsg(`Invitación enviada a ${email}. La verá al iniciar sesión.`);
      } else {
        setMsg(`⚠ ${email} aún no tiene cuenta en la app. Pídele que se registre con ese correo para ver la invitación.`);
      }
      setEmail('');
      cargar();
    } catch (err) { setError(err.message); }
  }

  async function aceptar(id) { await api.post(`/invitations/${id}/aceptar`); cargar(); }
  async function rechazar(id) { await api.post(`/invitations/${id}/rechazar`); cargar(); }
  async function revocar(contadorId) {
    if (!confirm('¿Quitar el acceso de este contador a tus datos?')) return;
    await api.del(`/clientes/mis/contadores/${contadorId}`);
    cargar();
  }

  const textoInvitar = user.rol === 'contador'
    ? 'Invita a un cliente para gestionar sus impuestos:'
    : 'Invita a tu contador para que vea tus impuestos:';

  return (
    <>
      <div className="card">
        <h2>Invitar</h2>
        <p className="muted">{textoInvitar}</p>
        <form onSubmit={invitar}>
          <label>Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {msg && <p style={{ color: 'var(--verde)', fontSize: 14 }}>{msg}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit">Enviar invitación</button>
        </form>
      </div>

      <div className="card">
        <h2>Invitaciones recibidas</h2>
        {recibidas.length === 0 && <p className="muted">No tienes invitaciones pendientes.</p>}
        {recibidas.map((i) => (
          <div className="factura" key={i.id}>
            <div className="info">
              <div>{i.emisor_nombre}</div>
              <small>{i.emisor_email} · {i.emisor_rol === 'contador' ? 'Contador' : 'Particular'}</small>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn-link" onClick={() => aceptar(i.id)}>Aceptar</button>
              <button className="btn-del" onClick={() => rechazar(i.id)}>Rechazar</button>
            </div>
          </div>
        ))}
      </div>

      {user.rol === 'particular' && (
        <div className="card">
          <h2>Contadores con acceso</h2>
          {contadores.length === 0 && <p className="muted">Ningún contador tiene acceso a tus datos.</p>}
          {contadores.map((c) => (
            <div className="factura" key={c.id}>
              <div className="info"><div>{c.nombre}</div><small>{c.email}</small></div>
              <button className="btn-del" onClick={() => revocar(c.id)}>Quitar acceso</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
