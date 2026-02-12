-- Add "added by" to appointments (receptionist name who created the appointment)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS added_by TEXT;
