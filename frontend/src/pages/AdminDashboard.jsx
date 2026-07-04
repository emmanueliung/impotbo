import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/* ─── Helpers ─────────────────────────────────────────────── */
const fmt = (n, decimals = 4) =>
  Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const PARAM_META = {
  smn:                  { label: 'Salario Mínimo Nacional (SMN)', prefix: 'Bs', decimals: 2, hint: 'Base para el crédito fijo RC-IVA (2 × SMN × 13%)' },
  tasa_rciva:           { label: 'Tasa RC-IVA', prefix: '%', decimals: 2, multiplier: 100, hint: 'Impuesto RC-IVA para asalariados (13%)' },
  tasa_afp:             { label: 'Cotización Gestora Pública (ex AFP)', prefix: '%', decimals: 2, multiplier: 100, hint: 'Deducción del salario bruto antes del cálculo (12.71%)' },
  tasa_gestora:         { label: 'Tasa Gestora Pública', prefix: '%', decimals: 2, multiplier: 100, hint: 'Cotización Gestora Pública — mismo valor que tasa_afp' },
  tasa_it:              { label: 'Impuesto a las Transacciones (IT)', prefix: '%', decimals: 2, multiplier: 100, hint: 'Para independientes — 3% sobre ingresos' },
  tasa_iva:             { label: 'IVA Estándar', prefix: '%', decimals: 2, multiplier: 100, hint: 'IVA para independientes (13%)' },
  tasa_regimen_especial:{ label: 'Régimen Especial Siete-RG', prefix: '%', decimals: 2, multiplier: 100, hint: 'Tasa única para régimen especial (5% sobre ingresos)' },
};

function ParamRow({ param, onSave }) {
  const meta = PARAM_META[param.clave] ?? { label: param.clave, prefix: '', decimals: 4, hint: param.descripcion };
  const mult = meta.multiplier ?? 1;
  const displayVal = fmt(Number(param.valor) * mult, meta.decimals);
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(displayVal);
  const [saving,  setSaving]  = useState(false);
  const [ok,      setOk]      = useState(false);

  async function handleSave() {
    setSaving(true);
    const rawVal = Number(val) / mult;
    await onSave(param.clave, rawVal);
    setSaving(false);
    setOk(true);
    setEditing(false);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="param-row">
      <div className="param-info">
        <div className="param-label">{meta.label}</div>
        <div className="param-hint">{meta.hint}</div>
        <div className="param-since">Vigente desde: {param.vigente_desde?.slice(0, 10) ?? '—'}</div>
      </div>
      <div className="param-control">
        {editing ? (
          <div className="param-edit-group">
            <input
              className="param-input"
              type="number"
              step="any"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              autoFocus
            />
            <span className="param-unit">{meta.prefix}</span>
            <button className="qa-btn qa-btn-ok" onClick={handleSave} disabled={saving}>
              {saving ? '…' : '✓'}
            </button>
            <button className="qa-btn" onClick={() => setEditing(false)}>✕</button>
          </div>
        ) : (
          <div className="param-display">
            <span className="param-value">
              {meta.prefix === '%' ? `${displayVal}%` : `Bs ${displayVal}`}
            </span>
            {ok && <span style={{ color: 'var(--verde)', fontSize: 13, marginLeft: 6 }}>✓</span>}
            <button className="btn-link" style={{ marginLeft: 8 }} onClick={() => setEditing(true)}>
              Editar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function AdminDashboard() {
  const [params,  setParams]  = useState([]);
  const [stats,   setStats]   = useState(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/parametros'),
      api.get('/admin/stats'),
    ])
      .then(([p, s]) => {
        setParams(p);
        setStats(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function handleSave(clave, valor) {
    try {
      const updated = await api.put(`/parametros/${clave}`, { valor });
      setParams((prev) => prev.map((p) => p.clave === clave ? updated : p));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fade-up">
      <div className="greeting-card">
        <div className="greeting-name">Panel Admin 🛡️</div>
        <div className="greeting-sub">Parámetros fiscales y estadísticas</div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* ── Estadísticas rápidas ── */}
      {stats && (
        <div className="card">
          <h2>Resumen del Mes</h2>
          <div className="metric">
            <span>Clientes activos</span>
            <span className="val">{stats.totalClientes}</span>
          </div>
          <div className="metric">
            <span>Períodos pendientes de cierre</span>
            <span className="val" style={{ color: stats.clientesPendientes > 0 ? 'var(--naranja)' : 'var(--verde)' }}>
              {stats.clientesPendientes}
            </span>
          </div>
          <div className="metric">
            <span>Facturas cargadas este mes</span>
            <span className="val">{stats.facturasEsteMes.cantidad}</span>
          </div>
          <div className="metric">
            <span>Importe total declarado</span>
            <span className="val">
              Bs {Number(stats.facturasEsteMes.monto).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* ── Constantes fiscales ── */}
      <div className="card">
        <h2>⚙️ Constantes Fiscales</h2>
        <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
          Modifique los parámetros cuando cambien las disposiciones del SIN.
          Los cambios se aplican a todos los cálculos futuros.
        </p>

        {params.length === 0 && <p className="muted">Cargando parámetros…</p>}

        {params.map((p) => (
          <ParamRow key={p.clave} param={p} onSave={handleSave} />
        ))}
      </div>

      <div className="card">
        <h2>📌 Información Fiscal 2026</h2>
        <div className="info-block">
          <p><strong>RC-IVA Dependiente (Form. 110)</strong><br />
            Período mensual. Presentación hasta el día 13 del mes siguiente.
          </p>
        </div>
        <div className="info-block">
          <p><strong>IVA / IT Independiente (Form. 610)</strong><br />
            Período bimensual. Presentación según último dígito del NIT.
          </p>
        </div>
        <div className="info-block">
          <p><strong>Régimen Especial (Siete-RG)</strong><br />
            Tasa única del 5% sobre ingresos brutos. Presentación bimensual.
          </p>
        </div>
      </div>
    </div>
  );
}
