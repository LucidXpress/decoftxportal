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

export type OutlookCreateResult = {
  ok: boolean;
  eventId?: string;
  error?: string;
};

/** Graph expects dateTime without Z/offset when paired with timeZone. */
function toGraphDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
}

/** Get a valid access token for the user (refresh if expired). Returns null if not connected. */
export async function getMicrosoftAccessToken(
  userId: string
): Promise<{ token: string | null; error?: string }> {
  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("microsoft_access_token, microsoft_token_expires_at, microsoft_refresh_token")
    .eq("id", userId)
    .single();
  if (error || !user?.microsoft_refresh_token) {
    return { token: null, error: "Outlook is not connected for this account." };
  }

  const expiresAt = user.microsoft_token_expires_at
    ? new Date(user.microsoft_token_expires_at).getTime()
    : 0;
  const now = Date.now();
  // Refresh if expires in under 5 minutes
  if (expiresAt > now + 5 * 60 * 1000 && user.microsoft_access_token) {
    return { token: user.microsoft_access_token };
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { token: null, error: "Outlook integration is not configured on the server." };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: user.microsoft_refresh_token,
    grant_type: "refresh_token",
    scope: MICROSOFT_SCOPES,
  });
  const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    console.error("[Outlook] Token refresh failed.", {
      userId,
      status: tokenRes.status,
      body: errText.slice(0, 500),
    });
    return {
      token: null,
      error:
        "Outlook token refresh failed. Disconnect and reconnect Outlook in Settings (client secret may have expired).",
    };
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token) {
    return { token: null, error: "Outlook token refresh returned no access token." };
  }

  const newExpiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000
  ).toISOString();
  const updates: Record<string, unknown> = {
    microsoft_access_token: tokenData.access_token,
    microsoft_token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  };
  // Persist rotated refresh tokens when Microsoft returns a new one.
  if (tokenData.refresh_token) {
    updates.microsoft_refresh_token = tokenData.refresh_token;
  }
  await supabase.from("users").update(updates).eq("id", userId);

  return { token: tokenData.access_token };
}

export type OutlookEventInput = {
  subject: string;
  start: Date;
  end: Date;
  body?: string;
  categories?: string[];
};

/** Create a calendar event in the user's Outlook calendar. */
export async function createOutlookEvent(
  userId: string,
  event: OutlookEventInput
): Promise<OutlookCreateResult> {
  const { token, error: tokenError } = await getMicrosoftAccessToken(userId);
  if (!token) {
    return { ok: false, error: tokenError ?? "Outlook is not connected for this account." };
  }

  const categories = event.categories?.map((c) => c.trim()).filter((c) => c.length > 0);
  const payload: Record<string, unknown> = {
    subject: event.subject,
    start: {
      dateTime: toGraphDateTime(event.start),
      timeZone: "UTC",
    },
    end: {
      dateTime: toGraphDateTime(event.end),
      timeZone: "UTC",
    },
  };
  if (event.body) {
    payload.body = { contentType: "text", content: event.body };
  }
  if (categories && categories.length > 0) {
    payload.categories = categories;
  }

  const res = await fetch(GRAPH_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[Outlook] Create event failed.", {
      userId,
      status: res.status,
      subject: event.subject,
      body: errText.slice(0, 800),
    });
    return {
      ok: false,
      error: `Outlook rejected the calendar event (HTTP ${res.status}).`,
    };
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    return { ok: false, error: "Outlook created the event but returned no event id." };
  }
  console.info("[Outlook] Event created.", { userId, eventId: data.id, subject: event.subject });
  return { ok: true, eventId: data.id };
}

/** Check if Outlook integration is configured (client id/secret set). */
export function isOutlookConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}
