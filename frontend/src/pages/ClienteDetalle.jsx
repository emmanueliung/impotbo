import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Conversacion from '../components/Conversacion.jsx';

const bs = (n) => `Bs ${Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* ── Mini graphique en barres SVG ───────────────────────────── */
function MiniChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => Number(d.total_facturas)), 1);
  const W = 240, H = 90, BAR_W = 28, GAP = 10;
  const totalBars = data.length;
  const startX = (W - totalBars * (BAR_W + GAP) + GAP) / 2;

  return (
    <svg width={W} height={H + 20} aria-label="Historial trimestral">
      {data.map((d, i) => {
        const val    = Number(d.total_facturas);
        const barH   = maxVal > 0 ? Math.max(4, (val / maxVal) * H) : 4;
        const x      = startX + i * (BAR_W + GAP);
        const y      = H - barH;
        const isCurr = i === data.length - 1;
        return (
          <g key={d.id}>
            <rect
              x={x} y={y} width={BAR_W} height={barH} rx={4}
              fill={isCurr ? 'var(--verde)' : 'var(--verde-border)'}
            />
            <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle"
              fontSize={9} fill="var(--texto-muted)">
              {MESES[d.mes]?.slice(0, 3)}
            </text>
            {isCurr && (
              <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle"
                fontSize={9} fontWeight={700} fill="var(--verde)">
                {bs(val).replace('Bs ', '')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rciva,     setRciva]     = useState(null);
  const [facturas,  setFacturas]  = useState([]);
  const [historique, setHistorique] = useState([]);
  const [error,     setError]     = useState('');
  const [rappelOk,  setRappelOk]  = useState('');
  const [showChart, setShowChart] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1;

  useEffect(() => {
    (async () => {
      try {
        setRciva(await api.get(`/clientes/${id}/rciva?anio=${anio}&mes=${mes}`));
        setFacturas(await api.get(`/clientes/${id}/facturas`));
        setHistorique(await api.get(`/admin/historique/${id}`));
      } catch (err) { setError(err.message); }
    })();
  }, [id]);

  /* ── Rappel automatique ─── */
  async function enviarRappel(tipo) {
    try {
      await api.post(`/admin/rappel/${id}`, { tipo });
      setRappelOk('✅ Recordatorio enviado al cliente.');
      setTimeout(() => setRappelOk(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  /* ── Export CSV SIAT ─── */
  function exportarSIAT() {
    if (!facturas.length) return;
    setExporting(true);
    const cabecera = ['NIT Emisor', 'N° Factura', 'Cod. Autorización', 'Fecha', 'Importe (Bs)', 'Estado'];
    const filas = facturas.map((f) => [
      f.nit_proveedor,
      f.nro_factura,
      f.codigo_autorizacion ?? '',
      f.fecha?.slice(0, 10),
      f.importe,
      f.validado ? 'Válida' : 'Pendiente',
    ]);
    const csv = [cabecera, ...filas].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `SIAT_cliente_${id}_${anio}_${String(mes).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  if (error) return <p className="error">{error}</p>;
  if (!rciva) return <p className="muted">Cargando…</p>;
  const c = rciva.calculo;

  return (
    <>
      <button className="btn-link" onClick={() => navigate('/')}>‹ Volver a clientes</button>

      {/* ── Resumen RC-IVA ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <h2>RC-IVA · {MESES[mes]} {anio}</h2>
        <div className="metric"><span>Impuesto</span><span className="val">{bs(c.impuesto)}</span></div>
        <div className="metric"><span>Crédito por facturas</span><span className="val">{bs(c.creditoFacturas)}</span></div>
        <div className="metric"><span>A pagar</span><span className="val">{bs(c.aPagar)}</span></div>
        {c.objetivoCumplido
          ? <div className="estado-ok" style={{ marginTop: 12 }}>✓ Sin pago este mes</div>
          : <div className="estado-falta" style={{ marginTop: 12 }}>Faltan {bs(c.facturasFaltantes)} en facturas</div>
        }
      </div>

      {/* ── Acciones Rápidas ── */}
      <div className="card quick-actions">
        <h3 className="quick-actions-title">⚡ Acciones Rápidas</h3>
        {rappelOk && <p className="estado-ok" style={{ marginBottom: 10, padding: 8 }}>{rappelOk}</p>}
        <div className="quick-actions-grid">
          <button
            className="qa-btn qa-btn-warning"
            onClick={() => enviarRappel('facturas_pendientes')}
            title="Enviar recordatorio automático al cliente"
          >
            ⚠️ Rappel Facturas
          </button>
          <button
            className="qa-btn qa-btn-export"
            onClick={exportarSIAT}
            disabled={!facturas.length || exporting}
            title="Exportar CSV formato Facilito/SIAT"
          >
            📥 Exportar SIAT
          </button>
          <button
            className="qa-btn qa-btn-chart"
            onClick={() => setShowChart(!showChart)}
            title="Ver historial del trimestre"
          >
            📊 {showChart ? 'Ocultar' : 'Historial'}
          </button>
        </div>

        {/* ── Graphique trimestriel ── */}
        {showChart && historique.length > 0 && (
          <div className="mini-chart-wrap">
            <p className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
              Importe total de facturas — últimos {historique.length} periodos
            </p>
            <MiniChart data={historique} />
          </div>
        )}
      </div>

      {/* ── Facturas del cliente avec statuts ── */}
      <div className="card">
        <h2>Facturas del cliente</h2>
        {facturas.length === 0 && <p className="muted">Sin facturas registradas.</p>}
        {facturas.map((f) => (
          <div className="factura" key={f.id}>
            <div className="info">
              <div className="f-amount">{bs(f.importe)}</div>
              <div className="f-detail">N° {f.nro_factura} · NIT {f.nit_proveedor}</div>
              <div className="f-detail">{f.fecha?.slice(0, 10)}</div>
            </div>
            <span className={`badge-status ${f.validado ? 'badge-ok' : 'badge-pending'}`}>
              {f.validado ? '✅ Válida' : '⏳ Pendiente'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Conversación ── */}
      <Conversacion clienteId={id} />
    </>
  );
}
