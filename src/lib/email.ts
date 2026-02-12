/**
 * Email notifications via Resend.
 * Set RESEND_API_KEY and optionally EMAIL_FROM (defaults to onboarding@resend.dev for testing).
 */

import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM ?? "D.E.C. Portal <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return !!resendApiKey;
}

export type AppointmentScheduledPayload = {
  doctorEmail: string;
  doctorName: string | null;
  patientName: string;
  appointmentDate: Date;
  durationMinutes: number;
  examType: string;
  addedBy: string;
  internalNotes: string | null;
  oneDriveLink: string | null;
};

/**
 * Send the assigned doctor an email when a new appointment is created.
 * Does not throw; returns false if sending fails or email is not configured.
 */
export async function sendAppointmentScheduledEmail(
  payload: AppointmentScheduledPayload
): Promise<boolean> {
  if (!resendApiKey) return false;
  const resend = new Resend(resendApiKey);
  const dateStr = payload.appointmentDate.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const html = `
    <p>Hi${payload.doctorName ? ` ${payload.doctorName}` : ""},</p>
    <p>A new appointment has been scheduled and assigned to you.</p>
    <ul>
      <li><strong>Patient:</strong> ${escapeHtml(payload.patientName)}</li>
      <li><strong>Date & time:</strong> ${escapeHtml(dateStr)}</li>
      <li><strong>Duration:</strong> ${payload.durationMinutes} minutes</li>
      <li><strong>Exam type:</strong> ${escapeHtml(payload.examType)}</li>
      <li><strong>Added by:</strong> ${escapeHtml(payload.addedBy)}</li>
    </ul>
    ${payload.internalNotes ? `<p><strong>Notes:</strong> ${escapeHtml(payload.internalNotes)}</p>` : ""}
    ${payload.oneDriveLink ? `<p><strong>OneDrive link:</strong> <a href="${escapeHtml(payload.oneDriveLink)}">${escapeHtml(payload.oneDriveLink)}</a></p>` : ""}
    <p>Sign in to the portal to view your calendar and appointment details.</p>
  `.trim();

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [payload.doctorEmail],
    subject: `New appointment: ${payload.patientName} – ${payload.examType} (${dateStr})`,
    html,
  });
  return !error;
}

export type PatientAppointmentConfirmationPayload = {
  patientEmail: string;
  patientName: string;
  appointmentDate: Date;
  durationMinutes: number;
  examType: string;
  doctorName: string | null;
  oneDriveLink: string | null;
  practiceName?: string;
};

/**
 * Send the patient an email confirmation when their appointment is scheduled.
 * Does not throw; returns false if sending fails or email is not configured.
 */
export async function sendPatientAppointmentConfirmationEmail(
  payload: PatientAppointmentConfirmationPayload
): Promise<boolean> {
  if (!resendApiKey) return false;
  const resend = new Resend(resendApiKey);
  const dateStr = payload.appointmentDate.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const practice = payload.practiceName ?? "D.E.C. Of Texas";
  const html = `
    <p>Hi${payload.patientName ? ` ${escapeHtml(payload.patientName)}` : ""},</p>
    <p>Your appointment at ${escapeHtml(practice)} has been confirmed.</p>
    <ul>
      <li><strong>Date & time:</strong> ${escapeHtml(dateStr)}</li>
      <li><strong>Duration:</strong> ${payload.durationMinutes} minutes</li>
      <li><strong>Exam type:</strong> ${escapeHtml(payload.examType)}</li>
      ${payload.doctorName ? `<li><strong>Doctor:</strong> ${escapeHtml(payload.doctorName)}</li>` : ""}
    </ul>
    ${payload.oneDriveLink ? `<p><strong>Records link:</strong> <a href="${escapeHtml(payload.oneDriveLink)}">${escapeHtml(payload.oneDriveLink)}</a></p>` : ""}
    <p>If you need to reschedule or have questions, please contact us.</p>
  `.trim();

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [payload.patientEmail],
    subject: `Appointment confirmed: ${payload.examType} – ${dateStr}`,
    html,
  });
  return !error;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
