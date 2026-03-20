-- Add address fields for appointment location
-- Run in Supabase SQL editor or via: supabase db push

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS state TEXT;

