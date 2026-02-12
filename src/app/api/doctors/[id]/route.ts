import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateDoctorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email("Invalid email").transform((s) => s.trim().toLowerCase()).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "reception") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { allowed } = checkRateLimit(session.user.id, "appointments");
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateDoctorSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(" ") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", id)
    .eq("role", "doctor")
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.email != null) {
    const { data: emailTaken } = await supabase
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .neq("id", id)
      .maybeSingle();
    if (emailTaken) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    }
    updates.email = parsed.data.email;
  }
  if (parsed.data.password != null) {
    updates.password = bcrypt.hashSync(parsed.data.password, 10);
  }
  const { data: updated, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, name, email")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "reception") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { allowed } = checkRateLimit(session.user.id, "appointments");
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("users")
    .select("id")
    .eq("id", id)
    .eq("role", "doctor")
    .single();
  if (!target) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
