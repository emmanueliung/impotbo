import { useEcheancia } from '../hooks/useEcheancia.js';

const COLORES = {
  ok:       { bg: 'var(--verde-claro)',  border: 'var(--verde-border)',  color: 'var(--verde)' },
  alerta:   { bg: 'var(--oro-claro)',    border: '#f0c060',              color: 'var(--oro)'   },
  urgente:  { bg: '#fff5f5',             border: '#fca5a5',              color: 'var(--rojo)'  },
  vencido:  { bg: '#fff5f5',             border: '#fca5a5',              color: 'var(--rojo)'  },
};

const ICONOS = {
  ok:      '✓',
  alerta:  '⚠',
  urgente: '🔔',
  vencido: '⛔',
};

/**
 * Muestra una alerta compacta con el estado de la próxima declaración RC-IVA.
 * @param {{ nit: string|null }} props
 */
export default function AlertaEcheancia({ nit }) {
  const { nivel, texto, vencimiento } = useEcheancia(nit);

  // No mostrar si queda más de 10 días
  if (nivel === 'ok' && true) return null; // siempre mostrar — elimina '&& true' para ocultar en ok

  const estilo = COLORES[nivel];
  const fecha  = vencimiento.toLocaleDateString('es-BO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div
      role="alert"
      style={{
        background:   estilo.bg,
        border:       `1px solid ${estilo.border}`,
        color:        estilo.color,
        borderRadius: 'var(--radio-sm)',
        padding:      '11px 14px',
        marginBottom: 12,
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
        fontSize:     14,
        fontWeight:   nivel === 'ok' ? 400 : 600,
        lineHeight:   1.4,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{ICONOS[nivel]}</span>
      <div>
        <div>{texto} — Declaración RC-IVA</div>
        {nivel !== 'ok' && (
          <div style={{ fontWeight: 400, opacity: 0.8, fontSize: 12, marginTop: 2 }}>
            Fecha límite: {fecha}
          </div>
        )}
      </div>
    </div>
  );
}
