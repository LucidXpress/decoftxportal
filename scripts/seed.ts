/**
 * Seed users and sample appointments via Supabase.
 * Run: npx tsx scripts/seed.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in env (or .env.local).
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const seedPassword = process.env.PORTAL_SEED_PASSWORD ?? "changeme";
  const hashed = bcrypt.hashSync(seedPassword, 10);
  const receptionEmail = process.env.PORTAL_SEED_RECEPTION_EMAIL ?? "reception@decoftexas.com";
  const doctorEmail = process.env.PORTAL_SEED_DOCTOR_EMAIL ?? "doctor@decoftexas.com";

  const { data: existingReception } = await supabase.from("users").select("id, email").eq("email", receptionEmail).maybeSingle();
  let receptionId: string;
  if (existingReception) {
    await supabase.from("users").update({ password: hashed, name: "Reception", role: "reception", updated_at: new Date().toISOString() }).eq("id", existingReception.id);
    receptionId = existingReception.id;
  } else {
    const { data: created, error } = await supabase.from("users").insert({ email: receptionEmail, name: "Reception", password: hashed, role: "reception" }).select("id").single();
    if (error) throw error;
    receptionId = created.id;
  }
  console.log("Reception user:", receptionEmail);

  const { data: existingDoctor } = await supabase.from("users").select("id, email").eq("email", doctorEmail).maybeSingle();
  let doctorId: string;
  if (existingDoctor) {
    await supabase.from("users").update({ password: hashed, name: "Doctor", role: "doctor", updated_at: new Date().toISOString() }).eq("id", existingDoctor.id);
    doctorId = existingDoctor.id;
  } else {
    const { data: created, error } = await supabase.from("users").insert({ email: doctorEmail, name: "Doctor", password: hashed, role: "doctor" }).select("id").single();
    if (error) throw error;
    doctorId = created.id;
  }
  console.log("Doctor user:", doctorEmail);

  const { count } = await supabase.from("appointments").select("id", { count: "exact", head: true });
  if (count === 0) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await supabase.from("appointments").insert([
      { patient_name: "Sample Patient One", appointment_date: yesterday.toISOString(), duration_minutes: 60, exam_type: "IME - Workers' Comp", status: "completed", assigned_doctor_id: doctorId, internal_notes: "Demo appointment (past)." },
      { patient_name: "Sample Patient Two", appointment_date: today.toISOString(), duration_minutes: 45, exam_type: "MMI / IR Evaluation", status: "scheduled", assigned_doctor_id: doctorId, onedrive_link: "https://onedrive.live.com", internal_notes: "Demo appointment (today)." },
      { patient_name: "Sample Patient Three", appointment_date: tomorrow.toISOString(), duration_minutes: 90, exam_type: "Independent Medical Exam", status: "scheduled", assigned_doctor_id: doctorId, internal_notes: "Demo appointment (future)." },
      { patient_name: "Sample Patient Four", appointment_date: nextWeek.toISOString(), duration_minutes: 60, exam_type: "Second Opinion", status: "scheduled", assigned_doctor_id: doctorId },
      { patient_name: "Sample Patient Five", appointment_date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), duration_minutes: 60, exam_type: "IME - Workers' Comp", status: "cancelled", assigned_doctor_id: doctorId, internal_notes: "Demo cancelled appointment." },
    ]);
    console.log("Created 5 sample appointments for demo.");
  }

  console.log("\nSeed done. Sign in with the email above and password:", seedPassword === "changeme" ? "changeme (change after first login)" : "(your PORTAL_SEED_PASSWORD)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
