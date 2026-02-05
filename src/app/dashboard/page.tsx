import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { autoCompletePastDueAppointments } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { dbAppointmentToAppointment, type DbAppointment } from "@/types/database";
import { ReceptionDashboard } from "./ReceptionDashboard";
import { DoctorDashboard } from "./DoctorDashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  await autoCompletePastDueAppointments();

  const supabase = await createClient();
  const role = (session.user as { role: string }).role;

  if (role === "doctor") {
    const { data: rows } = await supabase
      .from("appointments")
      .select("*")
      .eq("assigned_doctor_id", session.user.id)
      .neq("status", "cancelled")
      .order("appointment_date", { ascending: true });
    const appointments = (rows ?? []) as DbAppointment[];
    const doctorIds = [...new Set(appointments.map((a) => a.assigned_doctor_id).filter(Boolean))] as string[];
    let doctorsMap: Record<string, { id: string; name: string | null; email: string | null }> = {};
    if (doctorIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name, email").in("id", doctorIds);
      if (users) users.forEach((u) => (doctorsMap[u.id] = { id: u.id, name: u.name, email: u.email }));
    }
    const list = appointments.map((r) =>
      dbAppointmentToAppointment(r, r.assigned_doctor_id ? doctorsMap[r.assigned_doctor_id] ?? null : null)
    );
    return (
      <DoctorDashboard
        appointments={list}
        userName={session.user.name ?? session.user.email ?? "Doctor"}
      />
    );
  }

  const { data: appointmentRows } = await supabase
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: true });
  const allAppointments = (appointmentRows ?? []) as DbAppointment[];
  const doctorIds = [...new Set(allAppointments.map((a) => a.assigned_doctor_id).filter(Boolean))] as string[];
  let doctorsMap: Record<string, { id: string; name: string | null; email: string | null }> = {};
  if (doctorIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name, email").in("id", doctorIds);
    if (users) users.forEach((u) => (doctorsMap[u.id] = { id: u.id, name: u.name, email: u.email }));
  }
  const appointments = allAppointments.map((r) =>
    dbAppointmentToAppointment(r, r.assigned_doctor_id ? doctorsMap[r.assigned_doctor_id] ?? null : null)
  );

  const { data: doctorRows } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("role", "doctor")
    .order("name", { ascending: true });
  const doctors = (doctorRows ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <ReceptionDashboard
      appointments={appointments}
      doctors={doctors}
    />
  );
}
