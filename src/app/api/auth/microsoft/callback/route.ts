import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { createOutlookEvent } from "@/lib/outlook";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    const baseUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return NextResponse.redirect(new URL("/auth/signin", baseUrl));
  }
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const baseUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const settingsUrl = new URL("/dashboard/settings", baseUrl);

  const cookieStore = await cookies();
  const savedState = cookieStore.get("outlook_oauth_state")?.value;
  cookieStore.delete("outlook_oauth_state");

  if (errorParam) {
    settingsUrl.searchParams.set("outlook", "error");
    settingsUrl.searchParams.set("message", errorParam);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state || state !== savedState) {
    settingsUrl.searchParams.set("outlook", "error");
    settingsUrl.searchParams.set("message", "invalid_callback");
    return NextResponse.redirect(settingsUrl);
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/microsoft/callback`;
  if (!clientId || !clientSecret) {
    settingsUrl.searchParams.set("outlook", "error");
    settingsUrl.searchParams.set("message", "not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    settingsUrl.searchParams.set("outlook", "error");
    settingsUrl.searchParams.set("message", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token || !tokenData.refresh_token) {
    settingsUrl.searchParams.set("outlook", "error");
    settingsUrl.searchParams.set("message", "no_tokens");
    return NextResponse.redirect(settingsUrl);
  }

  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000
  ).toISOString();
  const supabase = await createClient();
  await supabase
    .from("users")
    .update({
      microsoft_access_token: tokenData.access_token,
      microsoft_refresh_token: tokenData.refresh_token,
      microsoft_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  // Backfill existing upcoming appointments to Outlook on initial connect/reconnect.
  // This is best-effort: we keep connect success even if some event syncs fail.
  try {
    const role = (session.user as { role?: string }).role ?? "reception";
    const nowIso = new Date().toISOString();
    let query = supabase
      .from("appointments")
      .select("id, patient_name, exam_type, appointment_date, duration_minutes, internal_notes, added_by, onedrive_link, street_address, city, state, assigned_doctor_id, status")
      .gte("appointment_date", nowIso)
      .neq("status", "cancelled")
      .order("appointment_date", { ascending: true });
    if (role === "doctor") {
      query = query.eq("assigned_doctor_id", session.user.id);
    }
    const { data: rows } = await query;
    for (const row of rows ?? []) {
      const start = new Date(row.appointment_date);
      const end = new Date(start.getTime() + row.duration_minutes * 60 * 1000);
      const subject = `${row.patient_name} – ${row.exam_type}`;
      const body = [
        row.internal_notes && `Notes: ${row.internal_notes}`,
        row.added_by && `Added by: ${row.added_by}`,
        row.onedrive_link && `OneDrive: ${row.onedrive_link}`,
        row.street_address &&
          `Address: ${row.street_address}${row.city ? `, ${row.city}` : ""}${row.state ? `, ${row.state}` : ""}`,
      ]
        .filter(Boolean)
        .join("\n");
      await createOutlookEvent(session.user.id, { subject, start, end, body: body || undefined });
    }
    console.info("[Outlook] Backfilled existing appointments after connect.", {
      userId: session.user.id,
      count: (rows ?? []).length,
      role,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[Outlook] Backfill after connect failed.", { userId: session.user.id, error: message });
  }

  settingsUrl.searchParams.set("outlook", "connected");
  return NextResponse.redirect(settingsUrl);
}
