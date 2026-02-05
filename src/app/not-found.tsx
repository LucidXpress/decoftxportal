import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--dec-light-bg)] px-4">
      <div className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--dec-base)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--dec-muted)]">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
          >
            Go to dashboard
          </Link>
          <Link
            href="/auth/signin"
            className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
