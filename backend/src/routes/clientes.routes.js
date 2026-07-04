import { Router } from 'express';
import { query, getParametros } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { calcularRciva } from '../services/rciva.service.js';

const router = Router();
router.use(auth);

// Verifica que el usuario actual (contador) tenga acceso activo al cliente
async function tieneAcceso(contadorId, clienteId) {
  const { rows } = await query(
    `SELECT 1 FROM memberships
     WHERE contador_user_id = $1 AND cliente_user_id = $2 AND estado = 'activo'`,
    [contadorId, clienteId]
  );
  return rows.length > 0;
}

// GET /api/clientes  -> portafolio de clientes del contador
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT m.cliente_user_id AS id, u.nombre, u.email, u.nit, u.salario_bruto,
              u.tipo_contribuyente, u.regimen, u.ultimo_digito_nit, m.created_at
       FROM memberships m
       JOIN users u ON u.id = m.cliente_user_id
       WHERE m.contador_user_id = $1 AND m.estado = 'activo'
       ORDER BY u.nombre`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar clientes' });
  }
});

// GET /api/clientes/:clienteId/info -> perfil básico del cliente
router.get('/:clienteId/info', async (req, res) => {
  const { clienteId } = req.params;
  if (!(await tieneAcceso(req.user.id, clienteId))) {
    return res.status(403).json({ error: 'Sin acceso a este cliente' });
  }
  try {
    const { rows } = await query(
      `SELECT id, nombre, email, nit, salario_bruto, tipo_contribuyente, regimen, ultimo_digito_nit
       FROM users WHERE id = $1`,
      [clienteId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener info del cliente' });
  }
});

// GET /api/clientes/mis/contadores -> contadores que tienen acceso a MIS datos
router.get('/mis/contadores', async (req, res) => {
  const { rows } = await query(
    `SELECT m.contador_user_id AS id, u.nombre, u.email
     FROM memberships m
     JOIN users u ON u.id = m.contador_user_id
     WHERE m.cliente_user_id = $1 AND m.estado = 'activo'
     ORDER BY u.nombre`,
    [req.user.id]
  );
  res.json(rows);
});

// DELETE /api/clientes/mis/contadores/:contadorId -> revocar acceso de un contador
router.delete('/mis/contadores/:contadorId', async (req, res) => {
  await query(
    `UPDATE memberships SET estado = 'revocado'
     WHERE cliente_user_id = $1 AND contador_user_id = $2`,
    [req.user.id, req.params.contadorId]
  );
  res.json({ ok: true });
});

// GET /api/clientes/:clienteId/facturas
router.get('/:clienteId/facturas', async (req, res) => {
  const { clienteId } = req.params;
  if (!(await tieneAcceso(req.user.id, clienteId))) {
    return res.status(403).json({ error: 'Sin acceso a este cliente' });
  }
  const { rows } = await query(
    'SELECT * FROM facturas WHERE user_id = $1 ORDER BY fecha DESC',
    [clienteId]
  );
  res.json(rows);
});

// GET /api/clientes/:clienteId/rciva?anio=&mes=  -> cálculo del mes para el cliente
router.get('/:clienteId/rciva', async (req, res) => {
  const { clienteId } = req.params;
  const anio = Number(req.query.anio);
  const mes = Number(req.query.mes);
  if (!(await tieneAcceso(req.user.id, clienteId))) {
    return res.status(403).json({ error: 'Sin acceso a este cliente' });
  }
  try {
    const { rows: pRows } = await query(
      'SELECT * FROM periodos WHERE user_id = $1 AND anio = $2 AND mes = $3',
      [clienteId, anio, mes]
    );
    const periodo = pRows[0];
    const periodoId = periodo?.id;

    let montoFacturas = 0;
    if (periodoId) {
      const { rows: s } = await query(
        'SELECT COALESCE(SUM(importe),0) AS total FROM facturas WHERE periodo_id = $1',
        [periodoId]
      );
      montoFacturas = Number(s[0].total);
    }

    const params = await getParametros();
    const calculo = calcularRciva({
      salarioBruto: Number(periodo?.salario_mes) || 0,
      montoFacturas,
      smn: params.smn,
      tasa: params.tasa_rciva,
      tasaAfp: params.tasa_afp,
    });
    res.json({ periodo: periodo || null, montoFacturas, calculo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular' });
  }
});

// DELETE /api/clientes/:clienteId -> el contador deja de seguir a un cliente
router.delete('/:clienteId', async (req, res) => {
  await query(
    `UPDATE memberships SET estado = 'revocado'
     WHERE contador_user_id = $1 AND cliente_user_id = $2`,
    [req.user.id, req.params.clienteId]
  );
  res.json({ ok: true });
});

export default router;
