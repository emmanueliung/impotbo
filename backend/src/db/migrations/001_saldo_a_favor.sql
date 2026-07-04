-- ============================================================
-- Migration 001 : saldo_a_favor + cerrado_at dans periodos
-- Exécuter une seule fois :
--   psql -d impuestos_bo -f backend/src/db/migrations/001_saldo_a_favor.sql
-- ============================================================

ALTER TABLE periodos
  ADD COLUMN IF NOT EXISTS saldo_a_favor NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cerrado_at    TIMESTAMP;
