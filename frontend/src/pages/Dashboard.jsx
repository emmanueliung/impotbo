import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useEcheancia } from '../hooks/useEcheancia.js';
import AlertaEcheancia from '../components/AlertaEcheancia.jsx';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const bs = (n) => `Bs ${Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

/* ── Calcul bimestre ──────────────────────────────────────── */
function getBimestre(mes) {
  // Bimestres : 1(Ene-Feb), 2(Mar-Abr), 3(May-Jun), 4(Jul-Ago), 5(Sep-Oct), 6(Nov-Dic)
  return Math.ceil(mes / 2);
}
const BIMESTRE_LABEL = {
  1: 'Ene–Feb', 2: 'Mar–Abr', 3: 'May–Jun',
  4: 'Jul–Ago', 5: 'Sep–Oct', 6: 'Nov–Dic',
};

/* ── Bandeau rappel NIT ───────────────────────────────────── */
function RappelNIT({ nit }) {
  const { diasRestantes, nivel, texto } = useEcheancia(nit);
  if (nivel === 'ok' || diasRestantes > 5) return null;

  const colorMap = {
    urgente: { bg: 'var(--rojo-claro)', border: 'var(--rojo-border)', text: 'var(--rojo)' },
    vencido: { bg: 'var(--rojo-claro)', border: 'var(--rojo-border)', text: 'var(--rojo)' },
    alerta:  { bg: 'var(--oro-claro)',  border: 'var(--oro)',          text: 'var(--oro)' },
  };
  const col = colorMap[nivel] ?? colorMap.alerta;

  return (
    <div className="rappel-nit" style={{
      background: col.bg, border: `1px solid ${col.border}`, color: col.text,
    }}>
      🔔 {texto} — Último dígito NIT: <strong>{nit ? String(nit).slice(-1) : '—'}</strong>
    </div>
  );
}

/* ── Jauge bimensuelle ────────────────────────────────────── */
function JaugeBimestre({ creditoFacturas, objetivoEstimado, bimestre, anio }) {
  const pct = objetivoEstimado > 0
    ? Math.min(100, Math.round((creditoFacturas / objetivoEstimado) * 100))
    : 0;
  const falta = Math.max(0, objetivoEstimado - creditoFacturas);

  return (
    <div className="jauge-bimestre">
      <div className="jauge-header">
        <span className="jauge-label">
          Trimestre {bimestre} — {BIMESTRE_LABEL[bimestre] ?? ''} {anio}
        </span>
        <span className="jauge-pct">{pct}%</span>
      </div>
      <div className="jauge-track">
        <div
          className="jauge-fill"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? 'var(--verde)' : pct > 60 ? 'var(--oro)' : 'var(--rojo)',
          }}
        />
      </div>
      <div className="jauge-sub">
        {pct >= 100
          ? '✓ Objetivo bimensual cubierto'
          : `${bs(creditoFacturas)} de ${bs(objetivoEstimado)} — Faltan ${bs(falta)}`
        }
      </div>
    </div>
  );
}

/* ── Dashboard principal ─────────────────────────────────── */
export default function Dashboard() {
  const { user, esIndependiente, esRegimenEspecial } = useAuth();
  const navigate = useNavigate();
  const [data,  setData]  = useState(null);
  const [error, setError] = useState('');

  const hoy  = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1;
  const bimestre = getBimestre(mes);

  useEffect(() => {
    (async () => {
      try {
        const periodo = await api.post('/periodos', {
          anio, mes, salarioMes: user?.salarioBruto || 0,
        });
        const res = await api.get(`/periodos/${periodo.id}/rciva`);
        setData(res);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (error) return (
    <div className="card">
      <p className="error">{error}</p>
      <p className="muted" style={{ marginTop: 8 }}>Verifica que el servidor esté encendido.</p>
    </div>
  );

  if (!data) return (
    <div className="card">
      <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: '75%' }} />
    </div>
  );

  const c       = data.calculo;
  const saldoN1 = data.saldoReportado ?? 0;

  // Progression vers l'objectif (facturas)
  const objetivo = c.creditoFacturas + c.facturasFaltantes * 0.13;
  const progreso = objetivo > 0 ? Math.min(100, (c.creditoFacturas / objetivo) * 100) : 100;

  // Objectif bimensuel estimé (2 mois × impôt mensuel)
  const objetivoBimestre = c.impuesto * 2;

  // Titre de la période selon type
  const tituloPeriodo = esIndependiente
    ? `Bimestre ${bimestre} — ${BIMESTRE_LABEL[bimestre]} ${anio}`
    : `${MESES[mes]} ${anio} — RC-IVA`;

  const labelFormulario = esIndependiente ? 'Ver Form. 610' : 'Ver Formulario 110';

  return (
    <div className="fade-up">
      {/* Alerta de vencimiento RC-IVA */}
      <AlertaEcheancia nit={user?.nit} />

      {/* Rappel NIT personnalisé */}
      <RappelNIT nit={user?.nit} />

      {/* Saludo */}
      <div className="greeting-card">
        <div className="greeting-name">Hola, {user?.nombre?.split(' ')[0]} 👋</div>
        <div className="greeting-sub">{tituloPeriodo}</div>
        {(esIndependiente || esRegimenEspecial) && (
          <div className="badge-perfil">
            {esRegimenEspecial ? '🏢 Régimen Especial 5%' : '🧑‍💻 Independiente / Form. 610'}
          </div>
        )}
      </div>

      {/* Jauge bimensuelle pour indépendants */}
      {esIndependiente && (
        <JaugeBimestre
          creditoFacturas={c.creditoFacturas}
          objetivoEstimado={objetivoBimestre}
          bimestre={bimestre}
          anio={anio}
        />
      )}

      {/* Resumen numérico */}
      <div className="card">
        <h2>Tu situación del mes</h2>
        <div className="metric">
          <span>Salario del mes</span>
          <span className="val">{bs(data.periodo.salario_mes || 0)}</span>
        </div>
        <div className="metric">
          <span>Impuesto RC-IVA</span>
          <span className="val">{bs(c.impuesto)}</span>
        </div>
        <div className="metric">
          <span>Crédito fijo (automático)</span>
          <span className="val">{bs(c.creditoFijo)}</span>
        </div>
        <div className="metric">
          <span>Crédito por facturas</span>
          <span className="val">{bs(c.creditoFacturas)}</span>
        </div>
        {saldoN1 > 0 && (
          <div className="metric">
            <span>Saldo reportado (mes anterior)</span>
            <span className="val" style={{ color: 'var(--verde)' }}>{bs(saldoN1)}</span>
          </div>
        )}
      </div>

      {/* Estado + acción */}
      <div className="card">
        {c.objetivoCumplido ? (
          <div className="estado-ok">✓ Este mes no tienes que pagar RC-IVA</div>
        ) : (
          <>
            <div className="estado-falta">
              Te faltan {bs(c.facturasFaltantes)} en facturas
            </div>
            <div className="barra">
              <div className="barra-fill" style={{ width: `${progreso}%` }} />
            </div>
            <p className="muted">
              Presenta más facturas a tu nombre para cubrir tu impuesto este mes.
            </p>
          </>
        )}
        <button className="btn" onClick={() => navigate('/nueva-factura')}>
          📷 Agregar factura
        </button>
        <button
          className="btn btn-sec"
          style={{ marginTop: 10 }}
          onClick={() => navigate('/form110')}
        >
          {labelFormulario}
        </button>
      </div>
    </div>
  );
}
