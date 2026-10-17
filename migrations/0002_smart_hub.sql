-- 0002_smart_hub.sql: Evolución Smart Receipt & Post-Purchase Hub (Cloudflare D1)
-- Extiende el esquema sin romper 0001_init.sql

-- 1. Extensión de la tabla de carteles
ALTER TABLE carteles ADD COLUMN mode TEXT DEFAULT 'smart_hub' CHECK(mode IN ('direct_review', 'smart_hub'));
ALTER TABLE carteles ADD COLUMN tile_color TEXT DEFAULT 'white' CHECK(tile_color IN ('white', 'black'));
ALTER TABLE carteles ADD COLUMN claim_status TEXT DEFAULT 'claimed' CHECK(claim_status IN ('unclaimed', 'claimed'));

-- 2. Tabla hub_configs vinculada por tenant_id
CREATE TABLE IF NOT EXISTS hub_configs (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  sections_order TEXT NOT NULL DEFAULT '["loyalty","reviews","receipt","offers","socials","signup","footer"]',
  brand_color TEXT NOT NULL DEFAULT '#3A3FE0',
  logo_url TEXT,
  review_prompt TEXT NOT NULL DEFAULT '¿Cómo estuvo tu visita? Tu opinión nos ayuda a mejorar.',
  loyalty_title TEXT NOT NULL DEFAULT 'Club de Beneficios',
  loyalty_reward TEXT NOT NULL DEFAULT '10% OFF en tu próxima compra',
  stamps_required INTEGER NOT NULL DEFAULT 5,
  offer_title TEXT DEFAULT 'Promoción Especial',
  offer_desc TEXT DEFAULT 'Presentando este comprobante en tu próxima visita obtenés un beneficio exclusivo.',
  offer_cta TEXT DEFAULT 'Canjear en mostrador',
  offer_url TEXT,
  offer_image TEXT,
  socials_json TEXT NOT NULL DEFAULT '{"instagram":"","tiktok":"","facebook":"","whatsapp":"","web":""}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Tabla loyalty_members (Fidelidad y Pases de Wallet)
CREATE TABLE IF NOT EXISTS loyalty_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone_or_email TEXT NOT NULL,
  stamps INTEGER NOT NULL DEFAULT 1,
  points INTEGER NOT NULL DEFAULT 0,
  pass_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_tenant ON loyalty_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_contact ON loyalty_members(tenant_id, customer_phone_or_email);

-- 4. Tabla partner_referrals (Programa de Activation Partners)
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
