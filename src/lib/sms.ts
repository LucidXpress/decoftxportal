/**
 * SMS via Twilio. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (E.164, e.g. +15551234567).
 */

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export function isSmsConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

/** Normalize to E.164 for US: 10 digits -> +1XXXXXXXXXX */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/**
 * Send appointment confirmation SMS to the patient. Does not throw; returns false if not configured or send fails.
 */
export async function sendAppointmentConfirmationSms(params: {
  to: string;
  patientName: string;
  appointmentDate: Date;
  examType: string;
  practiceName?: string;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<boolean> {
  if (!accountSid || !authToken || !fromNumber) {
    console.warn("[SMS] Not configured (missing env vars).", {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
    });
    return false;
  }
  const dateStr = params.appointmentDate.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const practice = params.practiceName ?? "D.E.C. Of Texas";
  const addressParts = [params.streetAddress, params.city, params.state].filter(
    (p): p is string => !!p
  );
  const addressSnippet = addressParts.length ? ` Location: ${addressParts.join(", ")}.` : "";
  const body = `Your appointment at ${practice} is confirmed: ${dateStr} – ${params.examType}.${addressSnippet} Reply with questions or call us.`;

  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body,
      from: fromNumber,
      to: toE164(params.to),
    });
    // Helpful for debugging deliveries; Twilio IDs aren't sensitive.
    console.info("[SMS] Sent appointment confirmation.", {
      to: toE164(params.to),
      messageSid: result.sid,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Twilio message failed.", {
      to: toE164(params.to),
      from: fromNumber,
      error: message,
    });
    return false;
  }
}
