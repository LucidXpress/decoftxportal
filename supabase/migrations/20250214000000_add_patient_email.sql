-- Patient email for confirmation notification (optional)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_email TEXT;
