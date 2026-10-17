-- 0001_init.sql: Esquema Inicial de Toque en Cloudflare D1

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  review_url TEXT,
  plan TEXT DEFAULT 'beta_30d',
  is_associated_with_manufacturer INTEGER DEFAULT 0,
  manufacturer_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS carteles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id),
  name TEXT NOT NULL DEFAULT 'Caja Principal',
  role TEXT NOT NULL DEFAULT 'caja' CHECK(role IN ('resena', 'caja')),
  status TEXT NOT NULL DEFAULT 'sin_activar' CHECK(status IN ('sin_activar', 'active', 'inactive', 'trash')),
  review_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT,
  last_scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  cartel_id TEXT NOT NULL REFERENCES carteles(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  items_json TEXT NOT NULL DEFAULT '[]',
  method TEXT NOT NULL CHECK(method IN ('mp_qr', 'cash', 'card_manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  cartel_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready', 'claimed', 'expired', 'cancelled')),
  expires_at TEXT NOT NULL,
  business_name TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_carteles_code ON carteles(code);
CREATE INDEX IF NOT EXISTS idx_carteles_tenant ON carteles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_code ON receipts(cartel_code, status);
