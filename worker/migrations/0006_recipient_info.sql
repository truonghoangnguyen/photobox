-- Migration to add customer_name and customer_phone_suffix to print_jobs
ALTER TABLE print_jobs ADD COLUMN customer_name TEXT;
ALTER TABLE print_jobs ADD COLUMN customer_phone_suffix TEXT;
