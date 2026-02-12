"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const inputClass =
  "w-full max-w-xs rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2.5 text-[var(--dec-text)] transition-[box-shadow,border-color] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20";
const inputErrorClass =
  "w-full max-w-xs rounded-[var(--dec-radius-sm)] border border-[var(--dec-error)] bg-white px-3 py-2.5 text-[var(--dec-text)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--dec-text)]";

export function SettingsContent({ userName }: { userName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [outlookConfigured, setOutlookConfigured] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookDisconnecting, setOutlookDisconnecting] = useState(false);

  useEffect(() => {
    const outlook = searchParams.get("outlook");
    const message = searchParams.get("message");
    if (outlook === "connected") {
      setOutlookConnected(true);
      setSuccess("Outlook calendar connected. New appointments will be added to your calendar.");
      router.replace("/dashboard/settings", { scroll: false });
    } else if (outlook === "error") {
      setError(
        message === "not_configured"
          ? "Outlook integration is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
          : message === "token_exchange_failed"
            ? "Could not connect to Outlook. Please try again."
            : "Outlook connection failed. Please try again."
      );
      router.replace("/dashboard/settings", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetch("/api/settings/outlook")
      .then((r) => r.json())
      .then((data) => {
        setOutlookConfigured(!!data.configured);
        setOutlookConnected(!!data.connected);
      })
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = e.currentTarget;
    const currentPassword = (form.elements.namedItem("currentPassword") as HTMLInputElement).value;
    const newPassword = (form.elements.namedItem("newPassword") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    const err: Record<string, string> = {};
    if (!currentPassword) err.currentPassword = "Current password is required.";
    if (!newPassword) err.newPassword = "New password must be at least 8 characters.";
    else if (newPassword.length < 8) err.newPassword = "New password must be at least 8 characters.";
    if (newPassword !== confirmPassword) err.confirmPassword = "Passwords do not match.";
    if (Object.keys(err).length) {
      setFieldErrors(err);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (res.status === 204) {
        setSuccess("Password updated. Use your new password next time you sign in.");
        form.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) || "Failed to update password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--dec-base)] sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--dec-muted)]">
          Signed in as {userName}
        </p>
      </div>

      <section className="dec-card-container max-w-lg border border-[var(--dec-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--dec-text)]">
          Change password
        </h2>
        <p className="mt-1 text-sm text-[var(--dec-muted)]">
          Update your sign-in password. You’ll need to sign in again after changing it.
        </p>
        <form onSubmit={handleChangePassword} className="mt-6 flex flex-col gap-4">
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {success}
            </p>
          )}
          <div>
            <label htmlFor="currentPassword" className={labelClass}>
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className={fieldErrors.currentPassword ? inputErrorClass : inputClass}
              aria-invalid={!!fieldErrors.currentPassword}
            />
            {fieldErrors.currentPassword && (
              <p className="mt-1 text-sm text-[var(--dec-error)]">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="newPassword" className={labelClass}>
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={fieldErrors.newPassword ? inputErrorClass : inputClass}
              aria-invalid={!!fieldErrors.newPassword}
            />
            {fieldErrors.newPassword && (
              <p className="mt-1 text-sm text-[var(--dec-error)]">
                {fieldErrors.newPassword}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--dec-muted)]">
              At least 8 characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className={fieldErrors.confirmPassword ? inputErrorClass : inputClass}
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-sm text-[var(--dec-error)]">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-fit rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>

      <section className="dec-card-container max-w-lg border border-[var(--dec-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--dec-text)]">
          Outlook calendar
        </h2>
        <p className="mt-1 text-sm text-[var(--dec-muted)]">
          Connect your Outlook calendar so new appointments are added automatically to your calendar and the assigned doctor&apos;s calendar (if they have connected theirs).
        </p>
        {outlookConfigured ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {outlookConnected ? (
              <>
                <span className="text-sm font-medium text-emerald-700">Calendar connected</span>
                <button
                  type="button"
                  onClick={async () => {
                    setOutlookDisconnecting(true);
                    try {
                      const res = await fetch("/api/settings/outlook", { method: "DELETE" });
                      if (res.ok) setOutlookConnected(false);
                    } finally {
                      setOutlookDisconnecting(false);
                    }
                  }}
                  disabled={outlookDisconnecting}
                  className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
                >
                  {outlookDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </>
            ) : (
              <a
                href="/api/auth/microsoft"
                className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
              >
                Connect Outlook
              </a>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--dec-muted)]">
            Outlook integration is not configured. Ask an administrator to set up Microsoft Azure app credentials.
          </p>
        )}
      </section>

      <section className="dec-card-container max-w-lg border border-[var(--dec-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--dec-text)]">
          Sign out
        </h2>
        <p className="mt-1 text-sm text-[var(--dec-muted)]">
          Sign out of this device. You can sign back in with your email and password.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="mt-6 rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
