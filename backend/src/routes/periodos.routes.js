import { Router } from 'express';
import { query, getParametros } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { calcularRciva } from '../services/rciva.service.js';

const router = Router();
router.use(auth);

// ─────────────────────────────────────────────
// GET /api/periodos
// Lista todos los periodos del usuario autenticado (para el selectorperiodo)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, anio, mes, salario_mes, estado, saldo_a_favor, cerrado_at
       FROM periodos
       WHERE user_id = $1
       ORDER BY anio DESC, mes DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar periodos' });
  }
});

// ─────────────────────────────────────────────
// POST /api/periodos  { anio, mes, salarioMes }
// Crea (o devuelve) el periodo del mes
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { anio, mes, salarioMes } = req.body;
  if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });

  try {
    const { rows } = await query(
      `INSERT INTO periodos (user_id, anio, mes, salario_mes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, anio, mes)
       DO UPDATE SET salario_mes = COALESCE($4, periodos.salario_mes)
       RETURNING *`,
      [req.user.id, anio, mes, salarioMes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear periodo' });
  }
});

// ─────────────────────────────────────────────
// GET /api/periodos/:id/rciva
// Calculo RC-IVA en vivo, inyectando el saldo del mes N-1
// ─────────────────────────────────────────────
router.get('/:id/rciva', async (req, res) => {
  try {
    // 1. Cargar el periodo solicitado
    const { rows: pRows } = await query(
      'SELECT * FROM periodos WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    const periodo = pRows[0];
    if (!periodo) return res.status(404).json({ error: 'Periodo no encontrado' });

    // 2. Buscar el saldo a favor del mes anterior (N-1)
    const mesAnterior = periodo.mes === 1 ? 12 : periodo.mes - 1;
    const anioAnterior = periodo.mes === 1 ? periodo.anio - 1 : periodo.anio;

    const { rows: prevRows } = await query(
      `SELECT saldo_a_favor FROM periodos
       WHERE user_id = $1 AND anio = $2 AND mes = $3`,
      [req.user.id, anioAnterior, mesAnterior]
    );
    const saldoReportado = prevRows.length > 0 ? Number(prevRows[0].saldo_a_favor) : 0;

    // 3. Suma de facturas del periodo
    const { rows: sumRows } = await query(
      'SELECT COALESCE(SUM(importe), 0) AS total FROM facturas WHERE periodo_id = $1',
      [periodo.id]
    );
    const montoFacturas = Number(sumRows[0].total);

    // 4. Parámetros fiscales
    const params = await getParametros();

    // 5. Cálculo RC-IVA con saldo reportado
    const calculo = calcularRciva({
      salarioBruto: Number(periodo.salario_mes) || 0,
      montoFacturas,
      smn:          params.smn,
      tasa:         params.tasa_rciva,
      tasaAfp:      params.tasa_afp,
      saldoReportado,
    });

    res.json({ periodo, montoFacturas, saldoReportado, calculo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular RC-IVA' });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/periodos/:id/cerrar
// Cierra el periodo y almacena el saldo a favor calculado
// para que el mes siguiente pueda leerlo.
// ─────────────────────────────────────────────
router.patch('/:id/cerrar', async (req, res) => {
  try {
    // Verificar que el periodo pertenece al usuario
    const { rows: pRows } = await query(
      'SELECT * FROM periodos WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    const periodo = pRows[0];
    if (!periodo) return res.status(404).json({ error: 'Periodo no encontrado' });
    if (periodo.cerrado_at) {
      return res.status(409).json({ error: 'El periodo ya está cerrado' });
    }

    // Recalcular para obtener el saldo a favor actualizado
    const mesAnterior = periodo.mes === 1 ? 12 : periodo.mes - 1;
    const anioAnterior = periodo.mes === 1 ? periodo.anio - 1 : periodo.anio;
    const { rows: prevRows } = await query(
      `SELECT saldo_a_favor FROM periodos
       WHERE user_id = $1 AND anio = $2 AND mes = $3`,
      [req.user.id, anioAnterior, mesAnterior]
    );
    const saldoReportado = prevRows.length > 0 ? Number(prevRows[0].saldo_a_favor) : 0;

    const { rows: sumRows } = await query(
      'SELECT COALESCE(SUM(importe), 0) AS total FROM facturas WHERE periodo_id = $1',
      [periodo.id]
    );
    const montoFacturas = Number(sumRows[0].total);

    const params = await getParametros();
    const calculo = calcularRciva({
      salarioBruto: Number(periodo.salario_mes) || 0,
      montoFacturas,
      smn:          params.smn,
      tasa:         params.tasa_rciva,
      tasaAfp:      params.tasa_afp,
      saldoReportado,
    });

    // Guardar el saldo a favor y marcar como cerrado
    const { rows: updated } = await query(
      `UPDATE periodos
       SET estado = 'cerrado', saldo_a_favor = $1, cerrado_at = now()
       WHERE id = $2
       RETURNING *`,
      [calculo.saldoAfavor, periodo.id]
    );

    await query(
      `INSERT INTO audit_logs (user_id, accion, detalle) VALUES ($1, 'cerrar_periodo', $2)`,
      [req.user.id, JSON.stringify({ periodoId: periodo.id, saldoAfavor: calculo.saldoAfavor })]
    );

    res.json({ periodo: updated[0], calculo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar periodo' });
  }
});

export default router;
