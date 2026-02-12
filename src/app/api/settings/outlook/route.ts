import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { isOutlookConfigured } from "@/lib/outlook";
import { NextResponse } from "next/server";

/** GET: Check if Outlook is configured and if current user has calendar connected (does not expose tokens). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("microsoft_refresh_token")
    .eq("id", session.user.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    configured: isOutlookConfigured(),
    connected: !!data?.microsoft_refresh_token,
  });
}

/** DELETE: Disconnect Outlook calendar (clear stored tokens). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      microsoft_refresh_token: null,
      microsoft_access_token: null,
      microsoft_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
