import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.PORTAL_SEED_PASSWORD ?? "changeme";
  const hashed = bcrypt.hashSync(seedPassword, 10);

  const receptionEmail = process.env.PORTAL_SEED_RECEPTION_EMAIL ?? "reception@decoftexas.com";
  const doctorEmail = process.env.PORTAL_SEED_DOCTOR_EMAIL ?? "doctor@decoftexas.com";

  const reception = await prisma.user.upsert({
    where: { email: receptionEmail },
    update: {},
    create: {
      email: receptionEmail,
      name: "Reception",
      password: hashed,
      role: "reception",
    },
  });
  console.log("Reception user:", reception.email);

  const doctor = await prisma.user.upsert({
    where: { email: doctorEmail },
    update: {},
    create: {
      email: doctorEmail,
      name: "Doctor",
      password: hashed,
      role: "doctor",
    },
  });
  console.log("Doctor user:", doctor.email);

  // Sample appointments for demo (optional: only create if none exist)
  const existing = await prisma.appointment.count();
  if (existing === 0) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.appointment.createMany({
      data: [
        {
          patientName: "Sample Patient One",
          appointmentDate: yesterday,
          durationMinutes: 60,
          examType: "IME - Workers' Comp",
          status: "completed",
          assignedDoctorId: doctor.id,
          internalNotes: "Demo appointment (past).",
        },
        {
          patientName: "Sample Patient Two",
          appointmentDate: today,
          durationMinutes: 45,
          examType: "MMI / IR Evaluation",
          status: "scheduled",
          assignedDoctorId: doctor.id,
          oneDriveLink: "https://onedrive.live.com",
          internalNotes: "Demo appointment (today).",
        },
        {
          patientName: "Sample Patient Three",
          appointmentDate: tomorrow,
          durationMinutes: 90,
          examType: "Independent Medical Exam",
          status: "scheduled",
          assignedDoctorId: doctor.id,
          internalNotes: "Demo appointment (future).",
        },
        {
          patientName: "Sample Patient Four",
          appointmentDate: nextWeek,
          durationMinutes: 60,
          examType: "Second Opinion",
          status: "scheduled",
          assignedDoctorId: doctor.id,
        },
        {
          patientName: "Sample Patient Five",
          appointmentDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          examType: "IME - Workers' Comp",
          status: "cancelled",
          assignedDoctorId: doctor.id,
          internalNotes: "Demo cancelled appointment.",
        },
      ],
    });
    console.log("Created 5 sample appointments for demo.");
  }

  console.log("\nSeed done. Sign in with the email above and password:", seedPassword === "changeme" ? "changeme (change after first login)" : "(your PORTAL_SEED_PASSWORD)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
