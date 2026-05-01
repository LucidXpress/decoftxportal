-- Saved clinic addresses for appointment auto-fill
-- Run in Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS clinic_addresses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_addresses_created_at ON clinic_addresses(created_at);

ALTER TABLE clinic_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clinic_addresses'
      AND policyname = 'Allow anon read clinic addresses'
  ) THEN
    CREATE POLICY "Allow anon read clinic addresses"
      ON clinic_addresses FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clinic_addresses'
      AND policyname = 'Allow anon insert clinic addresses'
  ) THEN
    CREATE POLICY "Allow anon insert clinic addresses"
      ON clinic_addresses FOR INSERT WITH CHECK (true);
  END IF;
END $$;

INSERT INTO clinic_addresses (street_address, city, state)
SELECT '1327 Empire Central Dr. Suite 117', 'Dallas', 'TX'
WHERE NOT EXISTS (
  SELECT 1 FROM clinic_addresses
  WHERE lower(street_address) = lower('1327 Empire Central Dr. Suite 117')
    AND lower(city) = lower('Dallas')
    AND lower(state) = lower('TX')
);

INSERT INTO clinic_addresses (street_address, city, state)
SELECT '4411 Walzem Road Suite 108', 'San Antonio', 'TX'
WHERE NOT EXISTS (
  SELECT 1 FROM clinic_addresses
  WHERE lower(street_address) = lower('4411 Walzem Road Suite 108')
    AND lower(city) = lower('San Antonio')
    AND lower(state) = lower('TX')
);
