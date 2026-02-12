import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(" ") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;
  const supabase = await createClient();
  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("id, password")
    .eq("id", session.user.id)
    .single();
  if (fetchError || !user?.password) {
    return NextResponse.json({ error: "User not found or has no password set." }, { status: 404 });
  }
  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  const hashed = bcrypt.hashSync(newPassword, 10);
  const { error: updateError } = await supabase
    .from("users")
    .update({ password: hashed, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
