"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-8 text-center">
        <h2 className="text-xl font-semibold text-[var(--dec-base)]">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-[var(--dec-muted)]">
          An error occurred loading the dashboard. You can try again or sign out and sign back in.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
          >
            Try again
          </button>
          <a
            href="/auth/signin"
            className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
