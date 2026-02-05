import { prisma } from "@/lib/prisma";

/**
 * Marks all scheduled appointments as completed when their end time
 * (appointmentDate + durationMinutes) has passed.
 */
export async function autoCompletePastDueAppointments(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Appointment"
    SET status = 'completed'
    WHERE status = 'scheduled'
    AND ("appointmentDate" + ("durationMinutes" * interval '1 minute')) < NOW()
  `;
}
