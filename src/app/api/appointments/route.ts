import { auth } from "@/auth";
import { autoCompletePastDueAppointments } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  appointmentInsertToDb,
  dbAppointmentToAppointment,
  type DbAppointment,
} from "@/types/database";
import { isAllowedUrl } from "@/lib/validation";
import { createOutlookEvent } from "@/lib/outlook";
import { sendAppointmentScheduledEmail, sendPatientAppointmentConfirmationEmail } from "@/lib/email";
import { sendAppointmentConfirmationSms } from "@/lib/sms";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  patientName: z.string().min(1),
  addedBy: z.string().min(1, "Added by is required").transform((s) => s.trim()),
  patientPhone: z.string().optional().nullable().or(z.literal("")).transform((s) => (s && s.trim()) || null),
  patientEmail: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((s) => (s && s.trim()) || null)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  appointmentDate: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).default(60),
  examType: z.string().min(1),
  oneDriveLink: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v === "" || isAllowedUrl(v), { message: "URL must be https or http" }),
  internalNotes: z.string().optional(),
  assignedDoctorId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { allowed } = checkRateLimit(session.user.id, "appointments");
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  await autoCompletePastDueAppointments();
  const supabase = await createClient();
  const role = (session.user as { role: string }).role;

  let query = supabase.from("appointments").select("*").order("appointment_date", { ascending: true });
  if (role === "doctor") {
    query = query.eq("assigned_doctor_id", session.user.id).neq("status", "cancelled");
  }
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appointments = (rows ?? []) as DbAppointment[];
  const doctorIds = [...new Set(appointments.map((a) => a.assigned_doctor_id).filter(Boolean))] as string[];
  let doctorsMap: Record<string, { id: string; name: string | null; email: string | null }> = {};
  if (doctorIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name, email").in("id", doctorIds);
    if (users) users.forEach((u) => (doctorsMap[u.id] = { id: u.id, name: u.name, email: u.email }));
  }

  const result = appointments.map((r) =>
    dbAppointmentToAppointment(r, r.assigned_doctor_id ? doctorsMap[r.assigned_doctor_id] ?? null : null)
  );
  return NextResponse.json(result);
}

export async function POST(req: Request) {
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const first = Object.values(flat.fieldErrors).flat()[0];
    const message = (typeof first === "string" ? first : "Validation failed") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const data = parsed.data;
  const appointmentDate = new Date(data.appointmentDate);
  if (appointmentDate.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Appointment date and time cannot be in the past." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const insertPayload = appointmentInsertToDb({
    patientName: data.patientName,
    addedBy: data.addedBy,
    patientPhone: data.patientPhone ?? null,
    patientEmail: data.patientEmail ?? null,
    appointmentDate,
    durationMinutes: data.durationMinutes,
    examType: data.examType,
    oneDriveLink: data.oneDriveLink || null,
    internalNotes: data.internalNotes ?? null,
    assignedDoctorId: data.assignedDoctorId ?? null,
  });
  const { data: inserted, error } = await supabase.from("appointments").insert(insertPayload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = inserted as DbAppointment;
  let doctor: { id: string; name: string | null; email: string | null } | null = null;
  if (row.assigned_doctor_id) {
    const { data: u } = await supabase.from("users").select("id, name, email").eq("id", row.assigned_doctor_id).single();
    if (u) doctor = { id: u.id, name: u.name, email: u.email };
  }
  const appointment = dbAppointmentToAppointment(row, doctor);

  // Add to Outlook calendars if connected (reception + assigned doctor)
  const start = new Date(row.appointment_date);
  const end = new Date(start.getTime() + row.duration_minutes * 60 * 1000);
  const eventTitle = `${row.patient_name} – ${row.exam_type}`;
  const eventBody = [
    row.internal_notes && `Notes: ${row.internal_notes}`,
    row.added_by && `Added by: ${row.added_by}`,
    row.onedrive_link && `OneDrive: ${row.onedrive_link}`,
  ]
    .filter(Boolean)
    .join("\n");
  const outlookEvent = { subject: eventTitle, start, end, body: eventBody || undefined };
  await createOutlookEvent(session.user.id, outlookEvent);
  if (row.assigned_doctor_id) {
    await createOutlookEvent(row.assigned_doctor_id, outlookEvent);
  }

  // Email the assigned doctor when they have an email address
  if (doctor?.email) {
    sendAppointmentScheduledEmail({
      doctorEmail: doctor.email,
      doctorName: doctor.name,
      patientName: row.patient_name,
      appointmentDate: start,
      durationMinutes: row.duration_minutes,
      examType: row.exam_type,
      addedBy: row.added_by ?? "—",
      internalNotes: row.internal_notes,
      oneDriveLink: row.onedrive_link,
    }).catch(() => {});
  }

  // Email confirmation to patient when email is provided
  if (row.patient_email) {
    sendPatientAppointmentConfirmationEmail({
      patientEmail: row.patient_email,
      patientName: row.patient_name,
      appointmentDate: start,
      durationMinutes: row.duration_minutes,
      examType: row.exam_type,
      doctorName: doctor?.name ?? null,
      oneDriveLink: row.onedrive_link,
    }).catch(() => {});
  }

  // SMS confirmation to patient when phone number is provided
  if (row.patient_phone) {
    sendAppointmentConfirmationSms({
      to: row.patient_phone,
      patientName: row.patient_name,
      appointmentDate: start,
      examType: row.exam_type,
    }).catch(() => {});
  }

  return NextResponse.json(appointment);
}
