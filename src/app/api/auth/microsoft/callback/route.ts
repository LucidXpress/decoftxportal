import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
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

  settingsUrl.searchParams.set("outlook", "connected");
  return NextResponse.redirect(settingsUrl);
}
