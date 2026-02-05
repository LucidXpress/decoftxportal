"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    if (res?.url) window.location.href = res.url;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--dec-light-bg)] px-4">
      <div className="dec-card-container w-full max-w-sm border border-[var(--dec-border)] p-8">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/dec-logo.png"
            alt="D.E.C. Of Texas"
            width={220}
            height={64}
            className="h-auto w-full max-w-[220px] object-contain object-center"
            priority
          />
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--dec-text)]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2.5 text-[var(--dec-text)] placeholder:text-[var(--dec-muted)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--dec-text)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2.5 text-[var(--dec-text)] placeholder:text-[var(--dec-muted)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20"
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--dec-error)]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-full bg-[var(--dec-base)] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
