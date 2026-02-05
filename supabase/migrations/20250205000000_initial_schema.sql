-- D.E.C. Of Texas Portal – initial schema for Supabase
-- Run this in Supabase SQL Editor or via: supabase db push

-- Role type for users (avoid reserved name "role")
CREATE TYPE user_role AS ENUM ('reception', 'doctor');

-- Appointment status
CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- Users (portal staff and doctors)
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  password TEXT,
  role user_role NOT NULL DEFAULT 'reception',
  email_verified TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_name TEXT NOT NULL,
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  exam_type TEXT NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  onedrive_link TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_doctor_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_appointments_assigned_doctor_id ON appointments(assigned_doctor_id);
CREATE INDEX idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Enable RLS (optional; anon key can access if policies allow or RLS is permissive)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Allow anon/service role to read/write for portal (adjust policies for production)
CREATE POLICY "Allow anon read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow anon read appointments" ON appointments FOR SELECT USING (true);
CREATE POLICY "Allow anon insert appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update appointments" ON appointments FOR UPDATE USING (true);
CREATE POLICY "Allow anon insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update users" ON users FOR UPDATE USING (true);
