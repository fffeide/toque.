-- ============================================================
-- TOQUE D1 MIGRATION 0003: WALLETWALLET & 24H COOLDOWN
-- ============================================================

-- 1. Columnas requeridas en loyalty_members para flujo real de WalletWallet y Cooldown de 24h
ALTER TABLE loyalty_members ADD COLUMN barcode_token TEXT;
-- last_stamped_at ya existe desde 0002_smart_hub.sql.
-- wallet_serial, wallet_last_notification, last_notified_at y wallet_sync_error
-- ya se agregan en 0003_consumer_vault_and_network.sql.

-- Índice único para el código de barras numérico de 8 dígitos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_members_barcode_token ON loyalty_members(barcode_token);

-- 2. Columnas requeridas en hub_configs para configuración real del pase
ALTER TABLE hub_configs ADD COLUMN business_name TEXT;
-- stamps_required ya existe desde 0002_smart_hub.sql.
ALTER TABLE hub_configs ADD COLUMN reward_text TEXT;
ALTER TABLE hub_configs ADD COLUMN reward_value_ars INTEGER DEFAULT 0;
ALTER TABLE hub_configs ADD COLUMN color_preset TEXT DEFAULT 'dark';
ALTER TABLE hub_configs ADD COLUMN custom_color TEXT;
-- logo_url ya existe desde 0002_smart_hub.sql.
