import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DoctorsManagement } from "../DoctorsManagement";

export default async function DoctorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as { role: string }).role;
  if (role !== "reception") redirect("/dashboard");

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("role", "doctor")
    .order("name", { ascending: true });
  const doctors = (rows ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <DoctorsManagement initialDoctors={doctors} />
  );
}
