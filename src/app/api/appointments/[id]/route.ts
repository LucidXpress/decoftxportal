import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { dbAppointmentToAppointment, type DbAppointment } from "@/types/database";
import { isAllowedUrl } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  patientName: z.string().min(1).optional(),
  patientPhone: z.string().optional().nullable().or(z.literal("")),
  patientEmail: z.string().optional().nullable().or(z.literal("")).refine((v) => !v || v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  appointmentDate: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  examType: z.string().min(1).optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  oneDriveLink: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .refine((v) => v === undefined || v === null || v === "" || isAllowedUrl(v), {
      message: "URL must be https or http",
    }),
  internalNotes: z.string().optional().nullable(),
  assignedDoctorId: z.string().optional().nullable(),
});

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { allowed } = checkRateLimit(session.user.id, "appointments");
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "reception") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const updatePayload: Record<string, unknown> = {};
  if (data.patientName != null) updatePayload.patient_name = data.patientName;
  if (data.appointmentDate != null) {
    const appointmentDate = new Date(data.appointmentDate);
    if (appointmentDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Appointment date and time cannot be in the past." },
        { status: 400 }
      );
    }
    updatePayload.appointment_date = data.appointmentDate;
  }
  if (data.durationMinutes != null) updatePayload.duration_minutes = data.durationMinutes;
  if (data.examType != null) updatePayload.exam_type = data.examType;
  if (data.status != null) updatePayload.status = data.status;
  if (data.patientPhone !== undefined) updatePayload.patient_phone = (data.patientPhone && data.patientPhone.trim()) || null;
  if (data.patientEmail !== undefined) updatePayload.patient_email = (data.patientEmail && data.patientEmail.trim()) || null;
  if (data.oneDriveLink !== undefined) updatePayload.onedrive_link = data.oneDriveLink || null;
  if (data.internalNotes !== undefined) updatePayload.internal_notes = data.internalNotes;
  if (data.assignedDoctorId !== undefined) updatePayload.assigned_doctor_id = data.assignedDoctorId;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  const row = updated as DbAppointment;
  let doctor: { id: string; name: string | null; email: string | null } | null = null;
  if (row.assigned_doctor_id) {
    const { data: u } = await supabase.from("users").select("id, name, email").eq("id", row.assigned_doctor_id).single();
    if (u) doctor = { id: u.id, name: u.name, email: u.email };
  }
  const appointment = dbAppointmentToAppointment(row, doctor);
  return NextResponse.json(appointment);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("appointments").select("*").eq("id", id).single();
  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const appointmentRow = row as DbAppointment;
  const role = (session.user as { role: string }).role;
  if (role === "doctor" && appointmentRow.assigned_doctor_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let doctor: { id: string; name: string | null; email: string | null } | null = null;
  if (appointmentRow.assigned_doctor_id) {
    const { data: u } = await supabase.from("users").select("id, name, email").eq("id", appointmentRow.assigned_doctor_id).single();
    if (u) doctor = { id: u.id, name: u.name, email: u.email };
  }
  const appointment = dbAppointmentToAppointment(appointmentRow, doctor);
  return NextResponse.json(appointment);
}
