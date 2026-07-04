import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const query = (text, params) => pool.query(text, params);

// Carga los parámetros fiscales en un objeto { clave: valor }
export async function getParametros() {
  const { rows } = await query('SELECT clave, valor FROM parametros_fiscales');
  return Object.fromEntries(rows.map((r) => [r.clave, Number(r.valor)]));
}
