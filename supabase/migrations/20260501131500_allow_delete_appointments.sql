-- Allow deleting appointments through RLS
-- Run in Supabase SQL editor or via: supabase db push

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow anon delete appointments'
  ) THEN
    CREATE POLICY "Allow anon delete appointments"
      ON appointments FOR DELETE USING (true);
  END IF;
END $$;
