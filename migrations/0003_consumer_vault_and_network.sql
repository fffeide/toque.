-- 0003_consumer_vault_and_network.sql: Bóveda del Consumidor ("Toquecito") y Red de Beneficios
-- Persistencia híbrida localStorage + Cloudflare D1 con consentimiento desactivado por defecto (0)

-- 1. Tabla de usuarios consumidores (compradores)
CREATE TABLE IF NOT EXISTS consumer_users (
  id TEXT PRIMARY KEY,
  email_or_phone TEXT UNIQUE,
  display_name TEXT,
  consent_save_receipts INTEGER DEFAULT 0,
  consent_marketing_network INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Tabla de comprobantes/visitas guardadas por el comprador
CREATE TABLE IF NOT EXISTS consumer_receipts (
  id TEXT PRIMARY KEY,
  consumer_id TEXT,
  tenant_id TEXT,
  merchant_name TEXT,
  amount_ars REAL DEFAULT 0,
  discount_saved_ars REAL DEFAULT 0,
  category TEXT,
  receipt_note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 3. Tabla de formatos de activación de comercios en la Red Toque
CREATE TABLE IF NOT EXISTS network_activations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  format_type TEXT CHECK(format_type IN ('cross_benefit', 'tap_challenge', 'map_pin', 'receipt_banner')),
  title TEXT,
  discount_text TEXT,
  terms TEXT,
  active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_consumer_receipts_consumer ON consumer_receipts(consumer_id);
CREATE INDEX IF NOT EXISTS idx_consumer_receipts_tenant ON consumer_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_activations_tenant ON network_activations(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_network_activations_format ON network_activations(format_type, active);

-- 4. Columnas de sincronización con WalletWallet en loyalty_members
ALTER TABLE loyalty_members ADD COLUMN wallet_serial TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_last_notification TEXT;
ALTER TABLE loyalty_members ADD COLUMN last_notified_at TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_sync_error TEXT;

