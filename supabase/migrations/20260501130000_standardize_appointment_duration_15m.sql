-- Standardize all appointments to 15 minutes
-- Run in Supabase SQL editor or via: supabase db push

ALTER TABLE appointments
  ALTER COLUMN duration_minutes SET DEFAULT 15;

UPDATE appointments
SET duration_minutes = 15
WHERE duration_minutes IS DISTINCT FROM 15;
