import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const createExamTypeSchema = z.object({
  name: z.string().min(1, "Exam type is required").transform((s) => s.trim()),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { allowed } = checkRateLimit(session.user.id, "appointments");
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("exam_types").select("id, name").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const examTypes = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
  return NextResponse.json(examTypes);
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

  const parsed = createExamTypeSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(" ") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("exam_types")
    .insert({ name: parsed.data.name })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This exam type already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: created.id as string,
      name: created.name as string,
    },
    { status: 201 }
  );
}
