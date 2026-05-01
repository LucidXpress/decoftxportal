-- Saved exam types for appointment creation
-- Run in Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS exam_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_types_name ON exam_types(name);

ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_types'
      AND policyname = 'Allow anon read exam types'
  ) THEN
    CREATE POLICY "Allow anon read exam types"
      ON exam_types FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_types'
      AND policyname = 'Allow anon insert exam types'
  ) THEN
    CREATE POLICY "Allow anon insert exam types"
      ON exam_types FOR INSERT WITH CHECK (true);
  END IF;
END $$;

INSERT INTO exam_types (name)
SELECT 'MMI and IR'
WHERE NOT EXISTS (SELECT 1 FROM exam_types WHERE lower(name) = lower('MMI and IR'));

INSERT INTO exam_types (name)
SELECT 'IME'
WHERE NOT EXISTS (SELECT 1 FROM exam_types WHERE lower(name) = lower('IME'));

INSERT INTO exam_types (name)
SELECT 'Scheduled Award'
WHERE NOT EXISTS (SELECT 1 FROM exam_types WHERE lower(name) = lower('Scheduled Award'));
