-- Toque Carta: funciones por comercio + carta, mesas y pedidos.
-- Renombrá el prefijo (0008) si en tu repo ya existe ese número.

-- ===== Funciones por comercio (se prenden y apagan sin tocar el código) =====
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  default_enabled INTEGER NOT NULL DEFAULT 0 CHECK (default_enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tenant_features (
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, key)
);

INSERT OR IGNORE INTO feature_flags (key, description, default_enabled) VALUES
  ('club', 'Tarjeta de sellos', 1),
  ('stats', 'Estadísticas de carteles', 1),
  ('menu', 'Carta y pedidos por mesa', 0);

-- ===== Carta =====
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant ON menu_categories(tenant_id, sort);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),          -- en pesos enteros
  photo_key TEXT,                                      -- clave del archivo en el almacenamiento (más adelante)
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON menu_items(tenant_id, category_id, sort);

-- ===== Mesas =====
CREATE TABLE IF NOT EXISTS dining_tables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,                                 -- "Mesa 4", "Barra 2"
  code TEXT NOT NULL UNIQUE,                           -- va en el QR; nunca se reutiliza
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dining_tables_tenant ON dining_tables(tenant_id);

-- ===== Pedidos (comandas) =====
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (status IN ('nuevo', 'confirmado', 'listo', 'entregado', 'cobrado', 'cancelado')),
  note TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0), -- lo calcula el servidor
  sale_id TEXT,                                        -- venta de la Caja cuando se cobra
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  item_id TEXT,
  name TEXT NOT NULL,                                  -- copia del nombre al momento del pedido
  price INTEGER NOT NULL CHECK (price >= 0),           -- copia del precio al momento del pedido
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 20),
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
