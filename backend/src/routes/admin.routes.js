import { Router } from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

function soloContador(req, res, next) {
  if (req.user.rol !== 'contador') {
    return res.status(403).json({ error: 'Solo los contadores pueden acceder.' });
  }
  next();
}

// ─────────────────────────────────────────────
// GET /api/admin/stats
// Estadísticas globales para el contador
// ─────────────────────────────────────────────
router.get('/stats', soloContador, async (req, res) => {
  try {
    // Clientes activos
    const { rows: clientesRows } = await query(
      `SELECT COUNT(*) AS total
       FROM memberships
       WHERE contador_user_id = $1 AND estado = 'activo'`,
      [req.user.id]
    );
    const totalClientes = Number(clientesRows[0].total);

    // Clientes con períodos sin cerrar del mes actual
    const hoy  = new Date();
    const anio = hoy.getFullYear();
    const mes  = hoy.getMonth() + 1;

    const { rows: alertasRows } = await query(
      `SELECT COUNT(DISTINCT p.user_id) AS total
       FROM periodos p
       JOIN memberships m ON m.cliente_user_id = p.user_id
       WHERE m.contador_user_id = $1
         AND m.estado = 'activo'
         AND p.anio = $2
         AND p.mes = $3
         AND p.estado = 'abierto'
         AND p.cerrado_at IS NULL`,
      [req.user.id, anio, mes]
    );
    const clientesPendientes = Number(alertasRows[0].total);

    // Total facturas cargadas este mes (todos los clientes)
    const { rows: facturasRows } = await query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(f.importe),0) AS monto
       FROM facturas f
       JOIN memberships m ON m.cliente_user_id = f.user_id
       JOIN periodos p ON p.id = f.periodo_id
       WHERE m.contador_user_id = $1
         AND m.estado = 'activo'
         AND p.anio = $2
         AND p.mes = $3`,
      [req.user.id, anio, mes]
    );

    res.json({
      totalClientes,
      clientesPendientes,
      facturasEsteMes: {
        cantidad: Number(facturasRows[0].total),
        monto:    Number(facturasRows[0].monto),
      },
      mes,
      anio,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ─────────────────────────────────────────────
// POST /api/admin/rappel/:clienteId
// Envía un mensaje de recordatorio predefinido al cliente
// ─────────────────────────────────────────────
router.post('/rappel/:clienteId', soloContador, async (req, res) => {
  const { clienteId } = req.params;
  const { tipo = 'facturas_pendientes' } = req.body;

  const MENSAJES = {
    facturas_pendientes: '⚠️ Recordatorio: aún no has completado tus facturas para este período bimensual. Por favor, agrégalas antes de la fecha límite.',
    monto_incorrecto:    '⚠️ Hemos detectado un posible error en el monto de una de tus facturas. Por favor, revísala.',
    cierre_proximo:      '📅 Aviso: el cierre del período se acerca. Asegúrate de que todas tus facturas estén cargadas.',
    confirmacion:        '✅ Tus facturas han sido recibidas y verificadas. ¡Todo en orden para este período!',
  };

  const texto = MENSAJES[tipo] ?? MENSAJES.facturas_pendientes;

  try {
    // Verificar que el cliente pertenece a este contador
    const { rows: memRows } = await query(
      `SELECT 1 FROM memberships
       WHERE contador_user_id = $1 AND cliente_user_id = $2 AND estado = 'activo'`,
      [req.user.id, clienteId]
    );
    if (!memRows.length) {
      return res.status(404).json({ error: 'Cliente no encontrado o no autorizado.' });
    }

    // Insertar mensaje
    const { rows } = await query(
      `INSERT INTO mensajes (cliente_user_id, autor_user_id, texto)
       VALUES ($1, $2, $3) RETURNING *`,
      [clienteId, req.user.id, texto]
    );

    // Log de la acción rápida
    await query(
      `INSERT INTO quick_actions_log (contador_user_id, cliente_user_id, accion, resultado)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, clienteId, tipo, 'enviado']
    ).catch(() => {});

    res.status(201).json({ mensaje: rows[0], tipo, texto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar recordatorio' });
  }
});

// ─────────────────────────────────────────────
// GET /api/admin/historique/:clienteId
// 3 últimas bimensualidades del cliente (para gráfico)
// ─────────────────────────────────────────────
router.get('/historique/:clienteId', soloContador, async (req, res) => {
  const { clienteId } = req.params;

  try {
    // Verificar membresía
    const { rows: memRows } = await query(
      `SELECT 1 FROM memberships
       WHERE contador_user_id = $1 AND cliente_user_id = $2 AND estado = 'activo'`,
      [req.user.id, clienteId]
    );
    if (!memRows.length) {
      return res.status(404).json({ error: 'Cliente no autorizado.' });
    }

    // Últimos 6 períodos del cliente con suma de facturas
    const { rows } = await query(
      `SELECT p.id, p.anio, p.mes, p.estado, p.saldo_a_favor,
              COALESCE(SUM(f.importe), 0) AS total_facturas,
              COUNT(f.id) AS num_facturas
       FROM periodos p
       LEFT JOIN facturas f ON f.periodo_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.anio DESC, p.mes DESC
       LIMIT 6`,
      [clienteId]
    );

    res.json(rows.reverse()); // Orden cronológico para el gráfico
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

export default router;
