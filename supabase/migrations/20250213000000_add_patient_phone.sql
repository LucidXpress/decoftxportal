-- Patient phone for SMS confirmation (optional)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone TEXT;
