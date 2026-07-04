import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const bs = (n) => `Bs ${Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

const TIPO_LABEL = {
  dependiente:   '💼 Asalariado',
  independiente: '🧑‍💻 Independiente',
  ambos:         '🔄 Mixto',
};

const REGIMEN_LABEL = {
  general:  'Régimen General',
  siete_rg: 'Régimen Especial 5%',
};

export default function ClientesPortafolio() {
  const navigate = useNavigate();
  const [clientes, setClientes]   = useState([]);
  const [rcivas,   setRcivas]     = useState({});
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(true);

  const hoy  = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1;

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/clientes');
        setClientes(data);

        // Carga el estado RC-IVA de cada cliente en paralelo
        const entries = await Promise.allSettled(
          data.map(async (c) => {
            const r = await api.get(`/clientes/${c.id}/rciva?anio=${anio}&mes=${mes}`);
            return [c.id, r];
          })
        );
        const map = {};
        entries.forEach((e) => {
          if (e.status === 'fulfilled') {
            const [id, r] = e.value;
            map[id] = r;
          }
        });
        setRcivas(map);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="fade-up">
      <div className="greeting-card">
        <div className="greeting-name">Mis Clientes 👥</div>
        <div className="greeting-sub">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} activos</div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && (
        <div className="card">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, marginBottom: 10, borderRadius: 10 }} />
          ))}
        </div>
      )}

      {!loading && clientes.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <p>Aún no tienes clientes.<br />Invita a uno desde la pestaña «Admin».</p>
          </div>
        </div>
      )}

      {!loading && clientes.map((c) => {
        const r = rcivas[c.id];
        const ok = r?.calculo?.objetivoCumplido;
        const falta = r?.calculo?.facturasFaltantes;

        return (
          <div
            key={c.id}
            className="cliente-card"
            onClick={() => navigate(`/cliente/${c.id}`)}
          >
            <div className="cliente-avatar">
              {c.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="cliente-info">
              <div className="cliente-nombre">{c.nombre}</div>
              <div className="cliente-meta">
                {c.nit ? `NIT ${c.nit}` : c.email}
                {c.salario_bruto ? ` · ${bs(c.salario_bruto)}` : ''}
              </div>
              <div className="cliente-tags">
                {c.tipo_contribuyente && (
                  <span className="tag tag-tipo">{TIPO_LABEL[c.tipo_contribuyente] ?? c.tipo_contribuyente}</span>
                )}
                {c.regimen && c.regimen !== 'general' && (
                  <span className="tag tag-regimen">{REGIMEN_LABEL[c.regimen]}</span>
                )}
              </div>
            </div>
            <div className="cliente-status">
              {r ? (
                ok
                  ? <span className="status-dot status-ok" title="Objetivo cumplido">●</span>
                  : <span className="status-dot status-warn" title={`Faltan ${bs(falta)}`}>●</span>
              ) : (
                <span className="status-dot status-grey" title="Sin datos">●</span>
              )}
              <span className="btn-link">Ver ›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
