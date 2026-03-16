-- Migration to update print_jobs status check constraint to include 'draft'

-- 1. Create a new table with the updated check constraint
CREATE TABLE print_jobs_new (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  job_code TEXT NOT NULL UNIQUE,
  customer_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('draft', 'pending', 'processing', 'printed', 'completed', 'failed', 'cancelled')
  ),
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  output_r2_key TEXT,
  template_id TEXT,
  slot_count INTEGER NOT NULL DEFAULT 1,
  page_count INTEGER,
  price_per_page REAL,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

-- 2. Copy data from the old table to the new table
INSERT INTO print_jobs_new (
  id, station_id, job_code, customer_session_id, status, total_amount, 
  created_at, updated_at, output_r2_key, template_id, slot_count, 
  page_count, price_per_page
)
SELECT 
  id, station_id, job_code, customer_session_id, status, total_amount, 
  created_at, updated_at, output_r2_key, template_id, slot_count, 
  page_count, price_per_page
FROM print_jobs;

-- 3. Drop the old table
DROP TABLE print_jobs;

-- 4. Rename the new table to the old name
ALTER TABLE print_jobs_new RENAME TO print_jobs;

-- 5. Recreate indexes if any (idx_print_jobs_station_created was on (station_id, created_at DESC))
CREATE INDEX IF NOT EXISTS idx_print_jobs_station_created
  ON print_jobs (station_id, created_at DESC);
