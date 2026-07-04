import { Router } from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Genera un token simple (sin Math.random: basamos en datos + contador en BD)
function makeToken(userId) {
  return `inv_${userId}_${Date.now().toString(36)}_${Buffer.from(String(userId)).toString('hex')}`;
}

// POST /api/invitations  { destinatarioEmail }
// El emisor invita a otra persona. La dirección del vínculo se deduce del rol.
router.post('/', async (req, res) => {
  const { destinatarioEmail } = req.body;
  if (!destinatarioEmail) return res.status(400).json({ error: 'Email del destinatario requerido' });
  if (destinatarioEmail.toLowerCase() === req.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'No puedes invitarte a ti mismo' });
  }

  try {
    const email = destinatarioEmail.toLowerCase();

    // ¿El destinatario ya tiene cuenta? (sin envío de email, es necesario)
    const { rows: existe } = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    const tieneCuenta = existe.length > 0;

    const token = makeToken(req.user.id);
    const { rows } = await query(
      `INSERT INTO invitations (emisor_user_id, emisor_rol, destinatario_email, token)
       VALUES ($1, $2, $3, $4) RETURNING id, destinatario_email, estado, created_at`,
      [req.user.id, req.user.rol, email, token]
    );
    res.status(201).json({ ...rows[0], tieneCuenta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear invitación' });
  }
});

// GET /api/invitations/recibidas  -> invitaciones pendientes para mí
router.get('/recibidas', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.estado, i.created_at, i.emisor_rol,
              u.nombre AS emisor_nombre, u.email AS emisor_email
       FROM invitations i
       JOIN users u ON u.id = i.emisor_user_id
       WHERE i.destinatario_email = $1 AND i.estado = 'pendiente'
       ORDER BY i.created_at DESC`,
      [req.user.email.toLowerCase()]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar invitaciones' });
  }
});

// GET /api/invitations/enviadas -> las que yo envié
router.get('/enviadas', async (req, res) => {
  const { rows } = await query(
    `SELECT id, destinatario_email, estado, created_at
     FROM invitations WHERE emisor_user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// POST /api/invitations/:id/aceptar
router.post('/:id/aceptar', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM invitations WHERE id = $1 AND destinatario_email = $2 AND estado = 'pendiente'`,
      [req.params.id, req.user.email.toLowerCase()]
    );
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });

    // Determinar quién es contador y quién cliente según el rol del emisor
    let contadorId, clienteId;
    if (inv.emisor_rol === 'contador') {
      contadorId = inv.emisor_user_id;
      clienteId = req.user.id;
    } else {
      contadorId = req.user.id;       // yo (destinatario) soy el contador
      clienteId = inv.emisor_user_id; // el particular que invitó es el cliente
    }

    await query(
      `INSERT INTO memberships (contador_user_id, cliente_user_id)
       VALUES ($1, $2)
       ON CONFLICT (contador_user_id, cliente_user_id)
       DO UPDATE SET estado = 'activo'`,
      [contadorId, clienteId]
    );
    await query(`UPDATE invitations SET estado = 'aceptada' WHERE id = $1`, [inv.id]);

    res.json({ ok: true, mensaje: 'Vínculo creado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aceptar invitación' });
  }
});

// POST /api/invitations/:id/rechazar
router.post('/:id/rechazar', async (req, res) => {
  await query(
    `UPDATE invitations SET estado = 'rechazada'
     WHERE id = $1 AND destinatario_email = $2 AND estado = 'pendiente'`,
    [req.params.id, req.user.email.toLowerCase()]
  );
  res.json({ ok: true });
});

export default router;
