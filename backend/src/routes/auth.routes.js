import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { validarNit } from '../utils/validarNit.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nombre, email, password, nit, salarioBruto, rol, tipoContribuyente, regimen } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'nombre, email y password son obligatorios' });
  }
  if (nit && !validarNit(nit)) {
    return res.status(400).json({ error: 'NIT inválido' });
  }
  const rolFinal = ['particular', 'contador'].includes(rol) ? rol : 'particular';
  const tipoFinal = ['dependiente', 'independiente', 'ambos'].includes(tipoContribuyente) ? tipoContribuyente : 'dependiente';
  const regimenFinal = ['general', 'siete_rg'].includes(regimen) ? regimen : 'general';

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (nombre, email, password_hash, nit, salario_bruto, rol, tipo_contribuyente, regimen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, email, nit, salario_bruto, rol, tipo_contribuyente, regimen`,
      [nombre, email, hash, nit || null, salarioBruto || null, rolFinal, tipoFinal, regimenFinal]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '7d' }
    );
    res.json({
      token,
      user: {
        id:                user.id,
        nombre:            user.nombre,
        email:             user.email,
        nit:               user.nit,
        salarioBruto:      user.salario_bruto,
        rol:               user.rol,
        tipoContribuyente: user.tipo_contribuyente,
        regimen:           user.regimen,
        ultimoDigitoNit:   user.ultimo_digito_nit,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

export default router;
