import { auth } from "@/auth";
import { autoCompletePastDueAppointments } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  patientName: z.string().min(1),
  appointmentDate: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).default(60),
  examType: z.string().min(1),
  oneDriveLink: z.string().url().optional().or(z.literal("")),
  internalNotes: z.string().optional(),
  assignedDoctorId: z.string().cuid().optional().nullable(),
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
  const role = (session.user as { role: string }).role;
  if (role === "doctor") {
    const appointments = await prisma.appointment.findMany({
      where: { assignedDoctorId: session.user.id, status: { not: "cancelled" } },
      orderBy: { appointmentDate: "asc" },
      include: { assignedDoctor: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(appointments);
  }
  const appointments = await prisma.appointment.findMany({
    orderBy: { appointmentDate: "asc" },
    include: { assignedDoctor: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(appointments);
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const appointmentDate = new Date(data.appointmentDate);
  if (appointmentDate.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Appointment date and time cannot be in the past." },
      { status: 400 }
    );
  }
  const appointment = await prisma.appointment.create({
    data: {
      patientName: data.patientName,
      appointmentDate: appointmentDate,
      durationMinutes: data.durationMinutes,
      examType: data.examType,
      oneDriveLink: data.oneDriveLink || null,
      internalNotes: data.internalNotes ?? null,
      assignedDoctorId: data.assignedDoctorId ?? null,
    },
    include: { assignedDoctor: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(appointment);
}
