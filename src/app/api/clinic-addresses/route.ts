import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const createAddressSchema = z.object({
  streetAddress: z.string().min(1, "Street address is required").transform((s) => s.trim()),
  city: z.string().min(1, "City is required").transform((s) => s.trim()),
  state: z.string().min(1, "State is required").transform((s) => s.trim()),
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
  const { data, error } = await supabase
    .from("clinic_addresses")
    .select("id, street_address, city, state")
    .order("street_address", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const addresses = (data ?? []).map((row) => ({
    id: row.id as string,
    streetAddress: row.street_address as string,
    city: row.city as string,
    state: row.state as string,
  }));
  return NextResponse.json(addresses);
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

  const parsed = createAddressSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(" ") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("clinic_addresses")
    .insert({
      street_address: parsed.data.streetAddress,
      city: parsed.data.city,
      state: parsed.data.state,
    })
    .select("id, street_address, city, state")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    {
      id: created.id as string,
      streetAddress: created.street_address as string,
      city: created.city as string,
      state: created.state as string,
    },
    { status: 201 }
  );
}
