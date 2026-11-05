-- ONE-TIME RECOVERY for the existing production database toque-db only.
-- Run ONLY after confirming that migrations 0001_init.sql and 0002_smart_hub.sql
-- have already been applied manually and their schema matches the repository.
-- This does not create application tables; it only records those two migrations
-- so Wrangler will apply the remaining files without replaying them.

CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name)
VALUES ('0001_init.sql'), ('0002_smart_hub.sql');
