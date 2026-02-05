import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { autoCompletePastDueAppointments } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";
import { ReceptionDashboard } from "./ReceptionDashboard";
import { DoctorDashboard } from "./DoctorDashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  await autoCompletePastDueAppointments();

  const role = (session.user as { role: string }).role;

  if (role === "doctor") {
    const appointments = await prisma.appointment.findMany({
      where: {
        assignedDoctorId: session.user.id,
        status: { not: "cancelled" },
      },
      orderBy: { appointmentDate: "asc" },
      include: {
        assignedDoctor: { select: { id: true, name: true, email: true } },
      },
    });
    return (
      <DoctorDashboard
        appointments={appointments}
        userName={session.user.name ?? session.user.email ?? "Doctor"}
      />
    );
  }

  const appointments = await prisma.appointment.findMany({
    orderBy: { appointmentDate: "asc" },
    include: {
      assignedDoctor: { select: { id: true, name: true, email: true } },
    },
  });
  const doctors = await prisma.user.findMany({
    where: { role: "doctor" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <ReceptionDashboard
      appointments={appointments}
      doctors={doctors}
    />
  );
}
