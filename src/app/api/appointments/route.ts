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
  streetAddress: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((s) => (s && s.trim()) || null),
  city: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((s) => (s && s.trim()) || null),
  state: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((s) => (s && s.trim()) || null),
  patientPhone: z.string().optional().nullable().or(z.literal("")).transform((s) => (s && s.trim()) || null),
  patientEmail: z
    .string()
    .email("Invalid email")
    .optional()
    .nullable()
    .transform((s) => (s && s.trim()) || null),
  appointmentDate: z.string().datetime(),
  examType: z.string().min(1),
  oneDriveLink: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v === "" || isAllowedUrl(v), { message: "URL must be https or http" }),
  internalNotes: z.string().optional(),
  assignedDoctorId: z.string().optional().nullable(),
  allowDuplicate: z.boolean().optional().default(false),
});

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function isQuarterHour(date: Date): boolean {
  const minutes = date.getMinutes();
  return minutes % 15 === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

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
  const doctorsMap: Record<string, { id: string; name: string | null; email: string | null }> = {};
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
  if (!isQuarterHour(appointmentDate)) {
    return NextResponse.json(
      { error: "Appointment time must be in 15-minute increments (e.g. 1:00, 1:15, 1:30, 1:45)." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  if (!data.allowDuplicate) {
    const { data: scheduledRows, error: scheduledError } = await supabase
      .from("appointments")
      .select("id, patient_name, appointment_date, street_address, city, state, assigned_doctor_id")
      .eq("status", "scheduled")
      .ilike("patient_name", data.patientName.trim())
      .order("appointment_date", { ascending: true })
      .limit(10);
    if (scheduledError) {
      return NextResponse.json({ error: scheduledError.message }, { status: 500 });
    }
    const duplicate = (scheduledRows ?? []).find(
      (row) => normalizeName(row.patient_name ?? "") === normalizeName(data.patientName)
    );
    if (duplicate) {
      let doctorName: string | null = null;
      if (duplicate.assigned_doctor_id) {
        const { data: doctor } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", duplicate.assigned_doctor_id)
          .maybeSingle();
        if (doctor) doctorName = doctor.name ?? doctor.email ?? null;
      }
      return NextResponse.json(
        {
          error: "A scheduled appointment for this claimant already exists.",
          code: "DUPLICATE_APPOINTMENT",
          duplicate: {
            id: duplicate.id,
            patientName: duplicate.patient_name,
            appointmentDate: duplicate.appointment_date,
            streetAddress: duplicate.street_address,
            city: duplicate.city,
            state: duplicate.state,
            doctorName,
          },
        },
        { status: 409 }
      );
    }
  }
  const insertPayload = appointmentInsertToDb({
    patientName: data.patientName,
    addedBy: data.addedBy,
    streetAddress: data.streetAddress,
    city: data.city,
    state: data.state,
    patientPhone: data.patientPhone ?? null,
    patientEmail: data.patientEmail ?? null,
    appointmentDate,
    durationMinutes: 15,
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
    row.street_address &&
      `Address: ${row.street_address}${row.city ? `, ${row.city}` : ""}${row.state ? `, ${row.state}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
  const doctorCategory = doctor?.name?.trim() || null;
  const outlookEvent = {
    subject: eventTitle,
    start,
    end,
    body: eventBody || undefined,
    categories: doctorCategory ? [doctorCategory] : undefined,
  };
  // Sync to the connected reception calendar. Doctor accounts are name-only now,
  // so doctor calendar push is best-effort only if they still have tokens.
  const outlookResult = await createOutlookEvent(session.user.id, outlookEvent);
  if (!outlookResult.ok) {
    console.error("[Appointment] Outlook sync failed for reception user.", {
      appointmentId: row.id,
      userId: session.user.id,
      error: outlookResult.error,
    });
  }
  if (row.assigned_doctor_id) {
    const doctorOutlook = await createOutlookEvent(row.assigned_doctor_id, outlookEvent);
    if (!doctorOutlook.ok) {
      console.info("[Appointment] Outlook sync skipped/failed for assigned doctor.", {
        appointmentId: row.id,
        doctorId: row.assigned_doctor_id,
        error: doctorOutlook.error,
      });
    }
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
      streetAddress: row.street_address,
      city: row.city,
      state: row.state,
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
      streetAddress: row.street_address,
      city: row.city,
      state: row.state,
    }).catch(() => {});
  }

  // SMS confirmation to patient when phone number is provided
  if (row.patient_phone) {
    const digits = String(row.patient_phone).replace(/\D/g, "");
    const last4 = digits.slice(-4);
    const masked = last4 ? `***-***-${last4}` : "***";
    console.info("[Appointment] Triggering SMS confirmation.", {
      appointmentId: row.id,
      to: masked,
    });
    sendAppointmentConfirmationSms({
      to: row.patient_phone,
      patientName: row.patient_name,
      appointmentDate: start,
      examType: row.exam_type,
      streetAddress: row.street_address,
      city: row.city,
      state: row.state,
    }).catch(() => {});
  }

  return NextResponse.json({
    ...appointment,
    outlookSynced: outlookResult.ok,
    outlookError: outlookResult.ok ? null : outlookResult.error ?? "Outlook sync failed.",
  });
}
