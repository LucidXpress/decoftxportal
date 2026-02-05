import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  patientName: z.string().min(1).optional(),
  appointmentDate: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  examType: z.string().min(1).optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  oneDriveLink: z.string().url().optional().nullable().or(z.literal("")),
  internalNotes: z.string().optional().nullable(),
  assignedDoctorId: z.string().cuid().optional().nullable(),
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
  const updateData: Parameters<typeof prisma.appointment.update>[0]["data"] = {};
  if (data.patientName != null) updateData.patientName = data.patientName;
  if (data.appointmentDate != null) {
    const appointmentDate = new Date(data.appointmentDate);
    if (appointmentDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Appointment date and time cannot be in the past." },
        { status: 400 }
      );
    }
    updateData.appointmentDate = appointmentDate;
  }
  if (data.durationMinutes != null) updateData.durationMinutes = data.durationMinutes;
  if (data.examType != null) updateData.examType = data.examType;
  if (data.status != null) updateData.status = data.status;
  if (data.oneDriveLink !== undefined)
    updateData.oneDriveLink = data.oneDriveLink || null;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  if (data.assignedDoctorId !== undefined)
    updateData.assignedDoctorId = data.assignedDoctorId;

  const appointment = await prisma.appointment.update({
    where: { id },
    data: updateData,
    include: { assignedDoctor: { select: { id: true, name: true, email: true } } },
  });
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
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { assignedDoctor: { select: { id: true, name: true, email: true } } },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const role = (session.user as { role: string }).role;
  if (role === "doctor" && appointment.assignedDoctorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(appointment);
}
