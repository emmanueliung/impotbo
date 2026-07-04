import { Router } from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// ─── Middleware: solo contadores pueden acceder ───────────────
function soloContador(req, res, next) {
  if (req.user.rol !== 'contador') {
    return res.status(403).json({ error: 'Solo los contadores pueden acceder a este recurso.' });
  }
  next();
}

// ─────────────────────────────────────────────
// GET /api/parametros
// Lista todos los parámetros fiscales configurables
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, clave, valor, descripcion, vigente_desde FROM parametros_fiscales ORDER BY clave'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener parámetros' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/parametros/:clave   { valor }
// Actualiza un parámetro fiscal (solo contadores)
// ─────────────────────────────────────────────
router.put('/:clave', soloContador, async (req, res) => {
  const { clave } = req.params;
  const { valor }  = req.body;

  if (valor === undefined || isNaN(Number(valor))) {
    return res.status(400).json({ error: 'valor numérico requerido' });
  }

  try {
    const { rows, rowCount } = await query(
      `UPDATE parametros_fiscales
       SET valor = $1, vigente_desde = now()
       WHERE clave = $2
       RETURNING *`,
      [Number(valor), clave]
    );
    if (!rowCount) return res.status(404).json({ error: 'Parámetro no encontrado' });

    await query(
      `INSERT INTO audit_logs (user_id, accion, detalle) VALUES ($1, 'actualizar_parametro', $2)`,
      [req.user.id, JSON.stringify({ clave, valorAnterior: null, valorNuevo: valor })]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar parámetro' });
  }
});

export default router;
