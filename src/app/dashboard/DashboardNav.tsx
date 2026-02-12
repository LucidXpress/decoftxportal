"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNav() {
  const pathname = usePathname();
  const linkClass = (path: string) =>
    `rounded px-3 py-2 text-sm font-medium transition ${
      pathname === path
        ? "bg-white/20 text-white"
        : "text-white/90 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <nav className="flex gap-1" aria-label="Dashboard sections">
      <Link href="/dashboard" className={linkClass("/dashboard")}>
        Appointments
      </Link>
      <Link href="/dashboard/doctors" className={linkClass("/dashboard/doctors")}>
        Doctors
      </Link>
    </nav>
  );
}
