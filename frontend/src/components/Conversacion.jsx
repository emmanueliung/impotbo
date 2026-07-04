import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/* ── Réponses rapides prédéfinies ─────────────────────────── */
const RESPUESTAS_RAPIDAS = [
  { label: '✅ Recibidas',    texto: '✅ Facturas recibidas y verificadas.' },
  { label: '⚠️ Monto',       texto: '⚠️ El monto de una factura parece incorrecto. Por favor revísala.' },
  { label: '📅 Recordatorio', texto: '📅 Recuerde que el plazo para presentar facturas se acerca.' },
  { label: '🔒 Periodo OK',   texto: '🔒 El período ha sido cerrado correctamente. Puede consultar su Form. 110.' },
];

export default function Conversacion({ clienteId }) {
  const { user, esContador } = useAuth();
  const [mensajes,  setMensajes]  = useState([]);
  const [texto,     setTexto]     = useState('');
  const [error,     setError]     = useState('');
  const [showRap,   setShowRap]   = useState(false);
  const finRef = useRef(null);

  async function cargar() {
    try {
      setMensajes(await api.get(`/mensajes/${clienteId}`));
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { cargar(); }, [clienteId]);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes]);

  async function enviar(e, textoOverride) {
    if (e?.preventDefault) e.preventDefault();
    const msg = textoOverride ?? texto;
    if (!msg.trim()) return;
    try {
      await api.post(`/mensajes/${clienteId}`, { texto: msg });
      setTexto('');
      setShowRap(false);
      cargar();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Mensajes</h2>
        {esContador && (
          <button
            className="btn btn-sec"
            style={{ padding: '4px 10px', fontSize: 12, marginTop: 0 }}
            onClick={() => setShowRap(!showRap)}
          >
            ⚡ Respuestas rápidas
          </button>
        )}
      </div>

      {/* Réponses rapides */}
      {esContador && showRap && (
        <div className="respuestas-rapidas">
          {RESPUESTAS_RAPIDAS.map((r) => (
            <button
              key={r.label}
              className="rr-btn"
              onClick={() => enviar(null, r.texto)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="chat">
        {mensajes.length === 0 && <p className="muted">Aún no hay mensajes. Escribe el primero.</p>}
        {mensajes.map((m) => {
          const mio = Number(m.autor_user_id) === Number(user.id);
          return (
            <div key={m.id} className={`burbuja ${mio ? 'mia' : 'suya'}`}>
              {!mio && (
                <small className="autor">
                  {m.autor_nombre} {m.autor_rol === 'contador' ? '(Contador)' : ''}
                </small>
              )}
              <div>{m.texto}</div>
              <small className="hora">
                {new Date(m.created_at).toLocaleString('es-BO', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </small>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="row" style={{ marginTop: 12 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un mensaje…"
          style={{ flex: 3 }}
        />
        <button type="submit" className="btn" style={{ marginTop: 0, flex: 1 }}>
          Enviar
        </button>
      </form>
    </div>
  );
}
