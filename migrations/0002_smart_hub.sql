-- 0002_smart_hub.sql: Evolución Smart Receipt, Post-Purchase Hub y Tarjeta de Sellos Digital (Cloudflare D1)
-- Extiende el esquema sin romper 0001_init.sql e inicializa el comercio oficial Musical Monroe

-- 1. Extensión de la tabla de carteles
ALTER TABLE carteles ADD COLUMN mode TEXT DEFAULT 'smart_hub' CHECK(mode IN ('direct_review', 'smart_hub'));
ALTER TABLE carteles ADD COLUMN tile_color TEXT DEFAULT 'white' CHECK(tile_color IN ('white', 'black'));
ALTER TABLE carteles ADD COLUMN claim_status TEXT DEFAULT 'claimed' CHECK(claim_status IN ('unclaimed', 'claimed'));

-- 2. Tabla hub_configs vinculada por tenant_id
CREATE TABLE IF NOT EXISTS hub_configs (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  sections_order TEXT NOT NULL DEFAULT '["loyalty","reviews","receipt","offers","socials","signup","footer"]',
  brand_color TEXT NOT NULL DEFAULT '#1e1b4b',
  logo_url TEXT,
  review_prompt TEXT NOT NULL DEFAULT '¿Cómo estuvo tu visita? Tu opinión nos ayuda a mejorar.',
  loyalty_title TEXT NOT NULL DEFAULT 'Tarjeta de sellos de Musical Monroe',
  loyalty_reward TEXT NOT NULL DEFAULT 'Beneficio exclusivo en instrumentos y accesorios',
  how_to_earn TEXT NOT NULL DEFAULT '1 sello por visita o compra',
  expiration_policy TEXT NOT NULL DEFAULT 'No vencen',
  stamps_required INTEGER NOT NULL DEFAULT 10,
  offer_title TEXT DEFAULT 'Beneficio Exclusivo',
  offer_desc TEXT DEFAULT 'Presentando tu tarjeta digital en mostrador sumás sellos y accedés a beneficios en instrumentos y accesorios.',
  offer_cta TEXT DEFAULT 'Canjear en mostrador',
  offer_url TEXT,
  offer_image TEXT,
  socials_json TEXT NOT NULL DEFAULT '{"instagram":"","tiktok":"","facebook":"","whatsapp":"","web":""}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Tabla loyalty_members (Minimización de datos Ley 25.326: solo día y mes de cumpleaños sin año, sin teléfono)
CREATE TABLE IF NOT EXISTS loyalty_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_code TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT NOT NULL,
  birth_day INTEGER,
  birth_month INTEGER,
  stamps INTEGER NOT NULL DEFAULT 0,
  stamps_required INTEGER NOT NULL DEFAULT 10,
  rewards_redeemed INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  consent INTEGER NOT NULL DEFAULT 0,
  pass_url TEXT,
  last_stamped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_tenant ON loyalty_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_email ON loyalty_members(tenant_id, customer_email);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_code ON loyalty_members(tenant_id, member_code);

-- 4. Tabla stamp_logs (Historial auditable referenciando solo member_id sin duplicar PII)
CREATE TABLE IF NOT EXISTS stamp_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('stamp_added', 'reward_redeemed')),
  stamps_delta INTEGER NOT NULL,
  staff_email TEXT,
  local_name TEXT DEFAULT 'Casa Central',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stamp_logs_tenant ON stamp_logs(tenant_id, created_at);

-- 5. Tabla partner_referrals (Programa de Activation Partners)
CREATE TABLE IF NOT EXISTS partner_referrals (
  id TEXT PRIMARY KEY,
  partner_code TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  merchant_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'activated', 'paid')),
  commission_rate REAL NOT NULL DEFAULT 0.20,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_code ON partner_referrals(partner_code);

-- 6. Configuración inicial lista para producción: "Musical Monroe" (MONROE01)
INSERT OR IGNORE INTO tenants (id, slug, name, owner_name, email, created_at)
VALUES ('musical-monroe', 'musical-monroe', 'Musical Monroe', 'Musical Monroe', 'hola@musicalmonroe.com.ar', datetime('now'));

INSERT OR IGNORE INTO carteles (id, code, tenant_id, name, role, status, mode, tile_color, claim_status, created_at)
VALUES ('cartel-monroe-01', 'MONROE01', 'musical-monroe', 'Mostrador Musical Monroe', 'caja', 'active', 'smart_hub', 'black', 'claimed', datetime('now'));

INSERT OR IGNORE INTO hub_configs (
  tenant_id,
  brand_color,
  loyalty_title,
  loyalty_reward,
  how_to_earn,
  expiration_policy,
  stamps_required,
  updated_at
) VALUES (
  'musical-monroe',
  '#1e1b4b',
  'Tarjeta de sellos de Musical Monroe',
  'Beneficio exclusivo en instrumentos y accesorios',
  '1 sello por visita o compra',
  'No vencen',
  10,
  datetime('now')
);
