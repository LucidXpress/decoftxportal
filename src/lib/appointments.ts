import { createClient } from "@/lib/supabase/server";

/**
 * Marks all scheduled appointments as completed when their end time
 * (appointment_date + duration_minutes) has passed.
 */
export async function autoCompletePastDueAppointments(): Promise<void> {
  const supabase = await createClient();
  const { data: scheduled, error: fetchError } = await supabase
    .from("appointments")
    .select("id, appointment_date, duration_minutes")
    .eq("status", "scheduled");

  if (fetchError || !scheduled?.length) return;

  const now = Date.now();
  const toComplete = scheduled.filter((row) => {
    const start = new Date(row.appointment_date).getTime();
    const end = start + row.duration_minutes * 60 * 1000;
    return end < now;
  });

  for (const row of toComplete) {
    await supabase.from("appointments").update({ status: "completed" }).eq("id", row.id);
  }
}
