// Ejecuta schema.sql contra la base configurada en .env
// Uso: npm run db:init
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('✅ Esquema aplicado correctamente');
  await pool.end();
}

run().catch((err) => {
  console.error('❌ Error al aplicar el esquema:', err.message);
  process.exit(1);
});
