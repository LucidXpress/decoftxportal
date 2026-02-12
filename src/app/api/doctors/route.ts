import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createDoctorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function GET() {
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
  const supabase = await createClient();
  const { data: doctors, error } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("role", "doctor")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(doctors ?? []);
}

export async function POST(req: Request) {
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createDoctorSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(" ") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const { data: created, error } = await supabase
    .from("users")
    .insert({ name, email, password: hashed, role: "doctor" })
    .select("id, name, email")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(created, { status: 201 });
}
