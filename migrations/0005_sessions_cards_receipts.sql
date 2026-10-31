-- ============================================================
-- TOQUE D1 MIGRATION 0005: PERSISTENT SESSIONS, SINGLE CARD LIMIT & SECURE RECEIPTS
-- ============================================================

-- 1. Tabla users para sesiones persistentes de comercios y administradores en D1 (cero Map en memoria)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'BUSINESS',
  session_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- 2. Tabla merchant_cards: 0 tarjetas por defecto para nuevos comercios y límite estricto de 1 tarjeta por tenant_id
CREATE TABLE IF NOT EXISTS merchant_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  stamps_required INTEGER NOT NULL DEFAULT 10,
  reward_text TEXT NOT NULL,
  reward_value_ars INTEGER NOT NULL DEFAULT 0,
  brand_color TEXT NOT NULL DEFAULT '#D95B26',
  color_preset TEXT NOT NULL DEFAULT 'dark',
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_cards_tenant_unique ON merchant_cards(tenant_id);

-- 3. Seguimiento del último cliente sellado en caja en hub_configs (para vincular comprobante en los 2 minutos posteriores sin usar memoria)
ALTER TABLE hub_configs ADD COLUMN last_stamped_consumer_id TEXT;
ALTER TABLE hub_configs ADD COLUMN last_stamped_at_ms INTEGER;
ALTER TABLE hub_configs ADD COLUMN store_lat REAL;
ALTER TABLE hub_configs ADD COLUMN store_lng REAL;

-- 4. Comprobantes emitidos en POS con prioridad de sello reciente (2 min) o ventana presencial de 90s + geolocalización (120m)
CREATE TABLE IF NOT EXISTS pos_receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  local_code TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  amount_ars INTEGER NOT NULL DEFAULT 0,
  discount_saved_ars INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  cash_received_ars INTEGER,
  change_ars INTEGER,
  items_json TEXT,
  note TEXT,
  claimed_by TEXT,
  expires_at_ms INTEGER NOT NULL,
  store_lat REAL,
  store_lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_receipts_tenant_expires ON pos_receipts(tenant_id, expires_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_pos_receipts_local_code ON pos_receipts(local_code, expires_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_pos_receipts_claimed_by ON pos_receipts(claimed_by);
