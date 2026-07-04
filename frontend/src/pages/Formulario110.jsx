import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/* ─── Helpers ─────────────────────────────────────────────── */
const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const bs = (n) =>
  `Bs ${Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

/* ─── Componente principal ────────────────────────────────── */
export default function Formulario110() {
  const { user, esIndependiente } = useAuth();
  const pageTitle = esIndependiente ? 'Formulario 610 — IVA Bimensual' : 'Formulario 110 — RC-IVA';

  const [periodos,       setPeriodos]       = useState([]);
  const [periodoSelId,   setPeriodoSelId]   = useState('');
  const [rciva,          setRciva]          = useState(null);
  const [facturas,       setFacturas]       = useState([]);
  const [cargando,       setCargando]       = useState(false);
  const [cerrando,       setCerrando]       = useState(false);
  const [error,          setError]          = useState('');
  const [mensajeOk,      setMensajeOk]      = useState('');

  /* Cargar lista de periodos al montar */
  useEffect(() => {
    api.get('/periodos')
      .then((rows) => {
        setPeriodos(rows);
        if (rows.length > 0) setPeriodoSelId(String(rows[0].id));
      })
      .catch(() => setError('No se pudieron cargar los periodos.'));
  }, []);

  /* Cargar datos del periodo seleccionado */
  useEffect(() => {
    if (!periodoSelId) return;
    setCargando(true);
    setError('');
    setMensajeOk('');
    setRciva(null);
    setFacturas([]);

    Promise.all([
      api.get(`/periodos/${periodoSelId}/rciva`),
      api.get(`/facturas?periodoId=${periodoSelId}`),
    ])
      .then(([rcivaData, facturasData]) => {
        setRciva(rcivaData);
        setFacturas(facturasData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [periodoSelId]);

  /* ─── Cerrar periodo ─── */
  async function cerrarPeriodo() {
    if (!confirm('¿Confirmar el cierre de este periodo? El saldo a favor quedará registrado para el mes siguiente.')) return;
    setCerrando(true);
    setError('');
    setMensajeOk('');
    try {
      const res = await api.patch(`/periodos/${periodoSelId}/cerrar`);
      setMensajeOk(`✓ Periodo cerrado. Saldo a favor registrado: ${bs(res.periodo.saldo_a_favor)}`);
      // Refrescar la lista de periodos y los datos del periodo actual
      const [rows, rcivaData, facturasData] = await Promise.all([
        api.get('/periodos'),
        api.get(`/periodos/${periodoSelId}/rciva`),
        api.get(`/facturas?periodoId=${periodoSelId}`),
      ]);
      setPeriodos(rows);
      setRciva(rcivaData);
      setFacturas(facturasData);
    } catch (err) {
      setError(err.message);
    } finally {
      setCerrando(false);
    }
  }

  /* ─── Exportar CSV ─── */
  function exportarCsv() {
    if (!rciva || !facturas.length) return;
    const { periodo, calculo, saldoReportado, montoFacturas } = rciva;
    const nombreMes = MESES[periodo.mes];
    const encabezado = [
      [`RC-IVA — ${nombreMes} ${periodo.anio} — ${user?.nombre ?? ''}`],
      [],
      ['Salario bruto',        `Bs ${calculo.salarioNeto}`],   // approx
      ['Salario neto (AFP)',   `Bs ${calculo.salarioNeto}`],
      ['Base imponible',       `Bs ${calculo.baseImponible}`],
      ['Impuesto RC-IVA',      `Bs ${calculo.impuesto}`],
      ['Crédito fijo',         `Bs ${calculo.creditoFijo}`],
      ['Crédito facturas',     `Bs ${calculo.creditoFacturas}`],
      ['Saldo reportado N-1',  `Bs ${saldoReportado}`],
      ['Total créditos',       `Bs ${calculo.totalCreditos}`],
      calculo.objetivoCumplido
        ? ['Saldo a favor',    `Bs ${calculo.saldoAfavor}`]
        : ['A PAGAR',          `Bs ${calculo.aPagar}`],
      [],
      ['DETALLE DE FACTURAS'],
      ['NIT Proveedor', 'N° Factura', 'Cod. Autorización', 'Fecha', 'Importe (Bs)'],
      ...facturas.map((f) => [
        f.nit_proveedor,
        f.nro_factura,
        f.codigo_autorizacion ?? '',
        f.fecha?.slice(0, 10),
        f.importe,
      ]),
      [],
      ['Total facturas', facturas.length],
      ['Importe total', montoFacturas],
    ];
    const csv = encabezado.map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `formulario110_${periodo.anio}_${String(periodo.mes).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── Periodo seleccionado ─── */
  const periodoObj = periodos.find((p) => String(p.id) === periodoSelId);
  const estaCerrado = !!periodoObj?.cerrado_at;

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Selector de periodo */}
      <div className="card">
        <h2>{pageTitle}</h2>
        <label>Periodo</label>
        <select
          value={periodoSelId}
          onChange={(e) => setPeriodoSelId(e.target.value)}
          disabled={periodos.length === 0}
        >
          {periodos.length === 0 && <option value="">Sin periodos</option>}
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>
              {MESES[p.mes]} {p.anio}
              {p.cerrado_at ? ' ✓ Cerrado' : ' (abierto)'}
            </option>
          ))}
        </select>
      </div>

      {/* Mensajes de estado */}
      {error     && <p className="error">{error}</p>}
      {mensajeOk && <p className="estado-ok" style={{ margin: '0 0 16px', padding: 12 }}>{mensajeOk}</p>}
      {cargando  && <p className="muted">Cargando…</p>}

      {/* Resumen RC-IVA */}
      {rciva && !cargando && (() => {
        const { calculo, saldoReportado, montoFacturas, periodo } = rciva;
        return (
          <>
            <div className="card">
              <h2>Resumen RC-IVA — {MESES[periodo.mes]} {periodo.anio}</h2>

              <div className="metric">
                <span>Salario neto (tras AFP)</span>
                <span className="val">{bs(calculo.salarioNeto)}</span>
              </div>
              <div className="metric">
                <span>Base imponible</span>
                <span className="val">{bs(calculo.baseImponible)}</span>
              </div>
              <div className="metric">
                <span>Impuesto RC-IVA (13%)</span>
                <span className="val">{bs(calculo.impuesto)}</span>
              </div>

              <div style={{ height: 1, background: 'var(--borde)', margin: '10px 0' }} />

              <div className="metric">
                <span>Crédito fijo (2 × SMN × 13%)</span>
                <span className="val">{bs(calculo.creditoFijo)}</span>
              </div>
              <div className="metric">
                <span>Crédito por facturas ({montoFacturas > 0 ? `${facturas.length} fact.` : '0 fact.'})</span>
                <span className="val">{bs(calculo.creditoFacturas)}</span>
              </div>
              {saldoReportado > 0 && (
                <div className="metric">
                  <span>Saldo reportado (mes anterior)</span>
                  <span className="val" style={{ color: 'var(--verde)' }}>{bs(saldoReportado)}</span>
                </div>
              )}
              <div className="metric" style={{ fontWeight: 700 }}>
                <span>Total créditos</span>
                <span className="val">{bs(calculo.totalCreditos)}</span>
              </div>

              <div style={{ height: 1, background: 'var(--borde)', margin: '10px 0' }} />

              {calculo.objetivoCumplido ? (
                <div className="estado-ok">✓ Saldo a favor: {bs(calculo.saldoAfavor)}</div>
              ) : (
                <div className="estado-falta">A pagar: {bs(calculo.aPagar)}</div>
              )}

              {/* Facturas aún necesarias */}
              {!calculo.objetivoCumplido && calculo.facturasFaltantes > 0 && (
                <p className="muted" style={{ marginTop: 8 }}>
                  Necesitas presentar {bs(calculo.facturasFaltantes)} más en facturas para no pagar este mes.
                </p>
              )}

              {/* Badge de estado del periodo */}
              {estaCerrado ? (
                <p className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
                  🔒 Periodo cerrado — Saldo reportado al mes siguiente: {bs(periodoObj.saldo_a_favor)}
                </p>
              ) : (
                <button
                  className="btn btn-sec"
                  style={{ marginTop: 14 }}
                  onClick={cerrarPeriodo}
                  disabled={cerrando}
                >
                  {cerrando ? 'Cerrando…' : '🔒 Cerrar periodo y reportar saldo'}
                </button>
              )}
            </div>

            {/* Tabla de facturas */}
            <div className="card">
              <h2>Facturas del periodo ({facturas.length})</h2>
              {facturas.length === 0 ? (
                <p className="muted">No hay facturas registradas en este periodo.</p>
              ) : (
                <>
                  {facturas.map((f) => (
                    <div className="factura" key={f.id}>
                      <div className="info">
                        <div>{bs(f.importe)} — N° {f.nro_factura}</div>
                        <small>NIT {f.nit_proveedor} · {f.fecha?.slice(0, 10)}</small>
                        {f.codigo_autorizacion && (
                          <small style={{ display: 'block', color: 'var(--gris)' }}>
                            Aut. {f.codigo_autorizacion}
                          </small>
                        )}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{bs(f.importe)}</span>
                    </div>
                  ))}
                  <div className="metric" style={{ marginTop: 10, fontWeight: 700 }}>
                    <span>Total ({facturas.length} facturas)</span>
                    <span>{bs(montoFacturas)}</span>
                  </div>
                </>
              )}

              <button
                className="btn"
                onClick={exportarCsv}
                disabled={facturas.length === 0}
                style={{ marginTop: 14 }}
              >
                ⬇ Exportar CSV / Excel
              </button>
              <p className="muted" style={{ marginTop: 10 }}>
                Este resumen es una ayuda. La presentación oficial se realiza en el portal del SIN.
              </p>
            </div>
          </>
        );
      })()}
    </>
  );
}
