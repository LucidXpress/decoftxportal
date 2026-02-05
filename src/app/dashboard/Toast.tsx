"use client";

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  );
}
