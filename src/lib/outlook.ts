/**
 * Outlook / Microsoft Graph calendar integration.
 * Requires MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and user OAuth tokens in DB.
 */

import { createClient } from "@/lib/supabase/server";

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_EVENTS_URL = "https://graph.microsoft.com/v1.0/me/calendar/events";

export const MICROSOFT_SCOPES = [
  "Calendars.ReadWrite",
  "User.Read",
  "offline_access",
].join(" ");

/** Get a valid access token for the user (refresh if expired). Returns null if not connected. */
export async function getMicrosoftAccessToken(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("microsoft_access_token, microsoft_token_expires_at, microsoft_refresh_token")
    .eq("id", userId)
    .single();
  if (error || !user?.microsoft_refresh_token) return null;

  const expiresAt = user.microsoft_token_expires_at
    ? new Date(user.microsoft_token_expires_at).getTime()
    : 0;
  const now = Date.now();
  // Refresh if expires in under 5 minutes
  if (expiresAt > now + 5 * 60 * 1000 && user.microsoft_access_token) {
    return user.microsoft_access_token;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: user.microsoft_refresh_token,
    grant_type: "refresh_token",
  });
  const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token) return null;

  const newExpiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000
  ).toISOString();
  await supabase
    .from("users")
    .update({
      microsoft_access_token: tokenData.access_token,
      microsoft_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return tokenData.access_token;
}

export type OutlookEventInput = {
  subject: string;
  start: Date;
  end: Date;
  body?: string;
};

/** Create a calendar event in the user's Outlook calendar. Returns event id or null. */
export async function createOutlookEvent(
  userId: string,
  event: OutlookEventInput
): Promise<string | null> {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;

  const res = await fetch(GRAPH_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.subject,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: "UTC",
      },
      body: event.body
        ? { contentType: "text", content: event.body }
        : undefined,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

/** Check if Outlook integration is configured (client id/secret set). */
export function isOutlookConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}
