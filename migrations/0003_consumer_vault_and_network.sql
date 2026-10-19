-- 0003_consumer_vault_and_network.sql: Bóveda del Consumidor ("Mi Toque") y Red de Beneficios estilo Pasito
-- Persistencia híbrida localStorage + Cloudflare D1

-- 1. Tabla de usuarios consumidores (compradores)
CREATE TABLE IF NOT EXISTS consumer_users (
  id TEXT PRIMARY KEY,
  email_or_phone TEXT UNIQUE,
  display_name TEXT,
  age_group TEXT DEFAULT 'all' CHECK(age_group IN ('teen', 'adult', 'all')),
  consent_save_receipts INTEGER DEFAULT 1,
  consent_marketing_network INTEGER DEFAULT 1,
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

-- 3. Tabla de formatos de activación de comercios en la Red Toque (estilo Pasito)
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
