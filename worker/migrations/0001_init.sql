CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'station_operator')),
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS station_users (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_station_users_station_user
  ON station_users (station_id, user_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  job_code TEXT NOT NULL UNIQUE,
  customer_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'printed', 'completed', 'failed', 'cancelled')
  ),
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_station_created
  ON print_jobs (station_id, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  print_job_id TEXT NOT NULL UNIQUE,
  invoice_code TEXT NOT NULL UNIQUE,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (print_job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO stations (id, slug, name, location, status)
VALUES
  ('st_tram1', 'tram1', 'Tram 1', 'Demo station 1', 'active'),
  ('st_tram2', 'tram2', 'Tram 2', 'Demo station 2', 'active'),
  ('st_tram3', 'tram3', 'Tram 3', 'Demo station 3', 'active');
