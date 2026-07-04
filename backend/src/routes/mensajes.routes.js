import { Router } from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// ¿El usuario actual puede ver/escribir en el hilo de este cliente?
// Sí si: es el propio cliente, o es un contador con acceso activo.
async function puedeAcceder(userId, clienteId) {
  if (Number(userId) === Number(clienteId)) return true;
  const { rows } = await query(
    `SELECT 1 FROM memberships
     WHERE contador_user_id = $1 AND cliente_user_id = $2 AND estado = 'activo'`,
    [userId, clienteId]
  );
  return rows.length > 0;
}

// GET /api/mensajes/:clienteId
router.get('/:clienteId', async (req, res) => {
  const { clienteId } = req.params;
  if (!(await puedeAcceder(req.user.id, clienteId))) {
    return res.status(403).json({ error: 'Sin acceso a esta conversación' });
  }
  const { rows } = await query(
    `SELECT m.id, m.texto, m.created_at, m.autor_user_id,
            u.nombre AS autor_nombre, u.rol AS autor_rol
     FROM mensajes m
     JOIN users u ON u.id = m.autor_user_id
     WHERE m.cliente_user_id = $1
     ORDER BY m.created_at ASC`,
    [clienteId]
  );
  res.json(rows);
});

// POST /api/mensajes/:clienteId  { texto }
router.post('/:clienteId', async (req, res) => {
  const { clienteId } = req.params;
  const { texto } = req.body;
  if (!texto || !texto.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
  if (!(await puedeAcceder(req.user.id, clienteId))) {
    return res.status(403).json({ error: 'Sin acceso a esta conversación' });
  }
  const { rows } = await query(
    `INSERT INTO mensajes (cliente_user_id, autor_user_id, texto)
     VALUES ($1, $2, $3) RETURNING id, texto, created_at, autor_user_id`,
    [clienteId, req.user.id, texto.trim()]
  );
  res.status(201).json(rows[0]);
});

export default router;
