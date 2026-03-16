-- Migration to add quantity to print_jobs
ALTER TABLE print_jobs ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
