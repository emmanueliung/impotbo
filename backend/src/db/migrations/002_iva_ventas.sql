-- ============================================================
-- Migration 002 : IVA/IT — tipo_contribuyente + ventas
-- psql -d impuestos_bo -f backend/src/db/migrations/002_iva_ventas.sql
-- ============================================================

-- 1. Tipo de contribuyente en usuarios
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tipo_contribuyente VARCHAR(20) DEFAULT 'dependiente';
-- Valores: 'dependiente' | 'independiente' | 'ambos'

-- 2. Saldo IVA a favor (para reportar mes a mes, independiente de RC-IVA)
ALTER TABLE periodos
  ADD COLUMN IF NOT EXISTS saldo_iva_a_favor NUMERIC(12,2) DEFAULT 0;

-- 3. Ventas (ingresos del independiente — genera débito fiscal IVA)
CREATE TABLE IF NOT EXISTS ventas (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    periodo_id          INTEGER REFERENCES periodos(id) ON DELETE CASCADE,
    nit_cliente         VARCHAR(20),            -- opcional (cliente final = null)
    nro_factura         VARCHAR(30) NOT NULL,   -- número de factura emitida
    fecha               DATE NOT NULL,
    importe             NUMERIC(12,2) NOT NULL CHECK (importe > 0),
    codigo_autorizacion VARCHAR(60),
    created_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_periodo ON ventas(periodo_id);
CREATE INDEX IF NOT EXISTS idx_ventas_user    ON ventas(user_id);
