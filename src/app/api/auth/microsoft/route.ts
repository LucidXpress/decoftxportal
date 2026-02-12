import { auth } from "@/auth";
import { MICROSOFT_SCOPES } from "@/lib/outlook";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const MICROSOFT_AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", process.env.APP_URL ?? "http://localhost:3000"));
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const baseUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  if (!clientId) {
    return NextResponse.redirect(new URL("/dashboard/settings?outlook=error&message=not_configured", baseUrl));
  }
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/microsoft/callback`;
  const state = crypto.randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("outlook_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPES,
    state,
    response_mode: "query",
  });
  const url = `${MICROSOFT_AUTHORIZE_URL}?${params.toString()}`;
  return NextResponse.redirect(url);
}
