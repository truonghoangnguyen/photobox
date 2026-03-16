-- Migration to add page_count and price_per_page to print_jobs
ALTER TABLE print_jobs ADD COLUMN page_count INTEGER;
ALTER TABLE print_jobs ADD COLUMN price_per_page REAL;
