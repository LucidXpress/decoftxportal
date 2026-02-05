import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/dashboard/actions";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as { role: string }).role;

  return (
    <div className="min-h-screen bg-[var(--dec-light-bg)]">
      <header className="relative border-b-4 border-[var(--dec-light)] bg-[var(--dec-base)] shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white transition opacity-90 hover:opacity-100"
          >
            D.E.C. Of Texas Portal
            <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-normal text-white/90">
              Internal
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white/85 sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white backdrop-blur-sm">
              {role}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
