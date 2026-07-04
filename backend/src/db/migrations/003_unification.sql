-- ============================================================
-- Migration 003 : Unification — régimen, validación facturas,
--                 log de acciones rápidas, nuevos parámetros
-- psql -d impuestos_bo -f backend/src/db/migrations/003_unification.sql
-- ============================================================

-- 1. Régimen fiscal en usuarios
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS regimen VARCHAR(20) DEFAULT 'general';
-- Valores: 'general' | 'siete_rg' (Régimen Especial - 5%)

-- 2. Último dígito NIT (calculado, para recordatorios personalizados)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ultimo_digito_nit INTEGER;

-- Trigger para calcular automáticamente el último dígito al insertar/actualizar
CREATE OR REPLACE FUNCTION calcular_ultimo_digito_nit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nit IS NOT NULL AND NEW.nit ~ '^[0-9]+$' THEN
    NEW.ultimo_digito_nit := CAST(RIGHT(NEW.nit, 1) AS INTEGER);
  ELSE
    NEW.ultimo_digito_nit := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ultimo_digito_nit ON users;
CREATE TRIGGER trg_ultimo_digito_nit
  BEFORE INSERT OR UPDATE OF nit ON users
  FOR EACH ROW EXECUTE FUNCTION calcular_ultimo_digito_nit();

-- Actualizar usuarios existentes
UPDATE users
SET ultimo_digito_nit = CAST(RIGHT(nit, 1) AS INTEGER)
WHERE nit IS NOT NULL AND nit ~ '^[0-9]+$';

-- 3. Campo validado en facturas (para QR/OCR)
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS validado BOOLEAN DEFAULT FALSE;
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS fuente_validacion VARCHAR(20) DEFAULT 'manual';
-- Valores fuente: 'manual' | 'qr' | 'ocr' | 'sin_api'

-- 4. Log de acciones rápidas del contador
CREATE TABLE IF NOT EXISTS quick_actions_log (
    id                SERIAL PRIMARY KEY,
    contador_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cliente_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    accion            VARCHAR(50) NOT NULL,
    -- 'rappel_facturas' | 'exportar_csv' | 'cerrar_periodo'
    resultado         TEXT,
    created_at        TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qal_contador ON quick_actions_log(contador_user_id);
CREATE INDEX IF NOT EXISTS idx_qal_cliente  ON quick_actions_log(cliente_user_id);

-- 5. Nuevos parámetros fiscales
INSERT INTO parametros_fiscales (clave, valor, descripcion) VALUES
  ('tasa_gestora',         0.1271, 'Cotización Gestora Pública (ex AFP) — 12.71%'),
  ('tasa_it',              0.03,   'Impuesto a las Transacciones — 3%'),
  ('tasa_regimen_especial',0.05,   'Régimen Especial Siete-RG — 5% sobre ingresos'),
  ('tasa_iva',             0.13,   'IVA estándar — 13%')
ON CONFLICT (clave) DO NOTHING;

-- Actualizar descripción de tasa_afp para reflejar cambio a Gestora
UPDATE parametros_fiscales
SET descripcion = 'Cotización Gestora Pública (antes AFP) — 12.71%'
WHERE clave = 'tasa_afp';
