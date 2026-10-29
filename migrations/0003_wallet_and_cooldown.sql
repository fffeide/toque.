-- ============================================================
-- TOQUE D1 MIGRATION 0003: WALLETWALLET & 24H COOLDOWN
-- ============================================================

-- 1. Columnas requeridas en loyalty_members para flujo real de WalletWallet y Cooldown de 24h
ALTER TABLE loyalty_members ADD COLUMN barcode_token TEXT;
ALTER TABLE loyalty_members ADD COLUMN last_stamped_at TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_serial TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_last_notification TEXT;
ALTER TABLE loyalty_members ADD COLUMN last_notified_at TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_sync_error TEXT;

-- Índice único para barcode_token (32 caracteres criptográficos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_members_barcode_token ON loyalty_members(barcode_token);

-- 2. Columnas requeridas en hub_configs para configuración real del pase
ALTER TABLE hub_configs ADD COLUMN business_name TEXT;
ALTER TABLE hub_configs ADD COLUMN stamps_required INTEGER DEFAULT 10;
ALTER TABLE hub_configs ADD COLUMN reward_text TEXT;
ALTER TABLE hub_configs ADD COLUMN reward_value_ars INTEGER DEFAULT 0;
ALTER TABLE hub_configs ADD COLUMN color_preset TEXT DEFAULT 'dark';
ALTER TABLE hub_configs ADD COLUMN custom_color TEXT;
ALTER TABLE hub_configs ADD COLUMN logo_url TEXT;
