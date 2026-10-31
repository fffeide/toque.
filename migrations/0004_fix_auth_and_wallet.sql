-- ============================================================
-- TOQUE D1 MIGRATION 0004: AUTH UNIFICATION, DIRECT WALLET & CODE128
-- ============================================================

-- 1. Asegurar tabla consumer_users con sesión persistente única
CREATE TABLE IF NOT EXISTS consumer_users_v2 (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  session_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copiar usuarios previos si existían en consumer_users
INSERT OR IGNORE INTO consumer_users_v2 (id, email, full_name, birth_date, created_at)
SELECT
  id,
  LOWER(TRIM(email_or_phone)),
  COALESCE(NULLIF(TRIM(display_name), ''), 'Cliente'),
  NULL,
  COALESCE(created_at, datetime('now'))
FROM consumer_users
WHERE email_or_phone IS NOT NULL AND TRIM(email_or_phone) != '';

DROP TABLE IF EXISTS consumer_users;
ALTER TABLE consumer_users_v2 RENAME TO consumer_users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consumer_users_email ON consumer_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consumer_users_session_token ON consumer_users(session_token);

-- 2. Asegurar columnas requeridas en loyalty_members para CODE128 de 8 dígitos y guardado directo Apple/Google Wallet
ALTER TABLE loyalty_members ADD COLUMN consumer_id TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_apple_base64 TEXT;
ALTER TABLE loyalty_members ADD COLUMN wallet_google_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_members_barcode_token_unique ON loyalty_members(barcode_token);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_consumer_id ON loyalty_members(consumer_id);

-- 3. Asegurar columnas de diseño y sincronización en hub_configs
ALTER TABLE hub_configs ADD COLUMN business_name TEXT;
ALTER TABLE hub_configs ADD COLUMN logo_url TEXT;
ALTER TABLE hub_configs ADD COLUMN brand_color TEXT DEFAULT '#D95B26';
ALTER TABLE hub_configs ADD COLUMN color_preset TEXT DEFAULT 'dark';
ALTER TABLE hub_configs ADD COLUMN stamps_required INTEGER DEFAULT 10;
ALTER TABLE hub_configs ADD COLUMN reward_text TEXT;
ALTER TABLE hub_configs ADD COLUMN reward_value_ars INTEGER DEFAULT 0;
