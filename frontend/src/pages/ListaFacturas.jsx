import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ImportarCSV from '../components/ImportarCSV.jsx';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const bs = (n) => `Bs ${Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

export default function ListaFacturas() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [periodos,  setPeriodos]  = useState([]);
  const [periodoId, setPeriodoId] = useState('');
  const [facturas,  setFacturas]  = useState([]);
  const [error,     setError]     = useState('');
  const [vista,     setVista]     = useState('lista'); // 'lista' | 'importar'

  // Cargar períodos al montar
  useEffect(() => {
    const hoy  = new Date();
    const anio = hoy.getFullYear();
    const mes  = hoy.getMonth() + 1;

    // Asegurarse de que existe el período actual
    api.post('/periodos', { anio, mes, salarioMes: user?.salarioBruto || 0 })
      .then(() => api.get('/periodos'))
      .then((rows) => {
        setPeriodos(rows);
        if (rows.length > 0) setPeriodoId(String(rows[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  // Cargar facturas cuando cambia el período seleccionado
  useEffect(() => {
    if (!periodoId) return;
    cargar();
  }, [periodoId]);

  async function cargar() {
    try {
      const url = periodoId ? `/facturas?periodoId=${periodoId}` : '/facturas';
      setFacturas(await api.get(url));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta factura?')) return;
    await api.del(`/facturas/${id}`);
    cargar();
  }

  const total       = facturas.reduce((s, f) => s + Number(f.importe), 0);
  const periodoObj  = periodos.find((p) => String(p.id) === periodoId);

  return (
    <>
      {/* ── Selector de período ── */}
      <div className="card">
        <h2>Mis facturas</h2>
        <label>Período</label>
        <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} disabled={periodos.length === 0}>
          {periodos.length === 0 && <option value="">Sin periodos</option>}
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>
              {MESES[p.mes]} {p.anio}{p.cerrado_at ? ' ✓' : ''}
            </option>
          ))}
        </select>

        {/* ── Tabs lista / importar ── */}
        <div className="login-tabs" style={{ marginTop: 14, marginBottom: 0 }}>
          <button
            className={`login-tab${vista === 'lista' ? ' active' : ''}`}
            type="button"
            onClick={() => setVista('lista')}
          >
            📋 Lista
          </button>
          <button
            className={`login-tab${vista === 'importar' ? ' active' : ''}`}
            type="button"
            onClick={() => setVista('importar')}
          >
            📂 Importar CSV
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* ── Vista: lista de facturas ── */}
      {vista === 'lista' && (
        <div className="card">
          {facturas.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🧾</span>
              <p>No hay facturas en este período.<br />Agrega una manualmente o importa desde el SIN.</p>
            </div>
          ) : (
            <>
              {facturas.map((f) => (
                <div className="factura" key={f.id}>
                  <div className="info">
                    <div className="f-amount">{bs(f.importe)}</div>
                    <div className="f-detail">
                      N° {f.nro_factura} · NIT {f.nit_proveedor}
                    </div>
                    <div className="f-detail">{f.fecha?.slice(0, 10)}</div>
                  </div>
                  <button className="btn-del" onClick={() => eliminar(f.id)} title="Eliminar">
                    🗑
                  </button>
                </div>
              ))}

              <div className="metric" style={{ marginTop: 10, fontWeight: 700 }}>
                <span>Total ({facturas.length} facturas)</span>
                <span>{bs(total)}</span>
              </div>
            </>
          )}

          <button className="btn" onClick={() => navigate('/nueva-factura')}>
            + Agregar factura
          </button>
        </div>
      )}

      {/* ── Vista: importar CSV ── */}
      {vista === 'importar' && periodoId && (
        <div className="card">
          <ImportarCSV
            periodoId={Number(periodoId)}
            onImportado={() => {
              setVista('lista');
              cargar();
            }}
          />
        </div>
      )}
    </>
  );
}
