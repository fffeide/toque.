-- Migración 0009: Pedidos con delivery/retiro, llamadas al mozo y reservas de mesas
-- Relacionados siempre con tenant_id para multi-comercio seguro.

-- 1. Campos adicionales en pedidos para soportar Salón, Delivery y Retiro
ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'mesa';
ALTER TABLE orders ADD COLUMN customer_name TEXT;
ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN customer_address TEXT;
ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'efectivo';

-- 2. Llamadas al mozo en tiempo real desde la mesa
CREATE TABLE IF NOT EXISTS waiter_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  table_id TEXT,
  table_label TEXT NOT NULL,
  table_code TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'atendido', 'cancelado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  attended_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_tenant_status ON waiter_calls(tenant_id, status, created_at);

-- 3. Reservas de mesas
CREATE TABLE IF NOT EXISTS table_reservations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  people_count INTEGER NOT NULL DEFAULT 2,
  reservation_date TEXT NOT NULL, -- YYYY-MM-DD
  reservation_time TEXT NOT NULL, -- HH:mm
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'cancelada', 'cumplida')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_table_reservations_tenant ON table_reservations(tenant_id, reservation_date);
