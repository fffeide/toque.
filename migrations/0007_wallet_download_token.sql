-- 0006_wallet_download_token.sql
-- Normaliza los campos de nombre/contacto que consulta el Worker.
ALTER TABLE loyalty_members ADD COLUMN name TEXT;
ALTER TABLE loyalty_members ADD COLUMN contact TEXT;
UPDATE loyalty_members
SET name = COALESCE(NULLIF(name, ''), customer_name),
    contact = COALESCE(NULLIF(contact, ''), customer_email);

-- Token de descarga aleatorio e independiente del barcode de ocho dígitos.
ALTER TABLE loyalty_members ADD COLUMN wallet_download_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_members_wallet_download_token
  ON loyalty_members(wallet_download_token)
  WHERE wallet_download_token IS NOT NULL AND wallet_download_token != '';
