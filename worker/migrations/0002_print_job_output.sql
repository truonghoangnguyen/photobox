ALTER TABLE print_jobs ADD COLUMN output_r2_key TEXT;
ALTER TABLE print_jobs ADD COLUMN template_id TEXT;
ALTER TABLE print_jobs ADD COLUMN slot_count INTEGER NOT NULL DEFAULT 1;
