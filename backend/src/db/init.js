// Ejecuta schema.sql y todas las migraciones contra la base configurada en .env
// Uso: npm run db:init
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  // 1. Aplicar esquema base
  console.log('⏳ Aplicando esquema base (schema.sql)...');
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schemaSql);
  console.log('✅ Esquema base aplicado correctamente');

  // 2. Aplicar migraciones ordenadas
  const migrationsDir = path.join(__dirname, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ordenar alfabéticamente (001, 002, 003...)

    console.log(`⏳ Se encontraron ${files.length} migraciones. Aplicando...`);
    for (const file of files) {
      console.log(`   Aplicando migración: ${file}...`);
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        await pool.query(migrationSql);
        console.log(`   ✅ Migración ${file} aplicada con éxito`);
      } catch (err) {
        console.error(`   ❌ Error al aplicar migración ${file}:`, err.message);
        throw err;
      }
    }
  }

  console.log('🎉 Inicialización y migraciones de la base de datos completadas con éxito');
  await pool.end();
}

run().catch((err) => {
  console.error('❌ Error al inicializar la base de datos:', err.message);
  process.exit(1);
});
