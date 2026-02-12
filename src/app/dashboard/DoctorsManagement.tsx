"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "./Toast";

type Doctor = { id: string; name: string | null; email: string | null };

const inputClass =
  "w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2.5 text-[var(--dec-text)] transition-[box-shadow,border-color] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20";
const inputErrorClass =
  "w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-error)] bg-white px-3 py-2.5 text-[var(--dec-text)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--dec-text)]";

export function DoctorsManagement({
  initialDoctors,
}: {
  initialDoctors: Doctor[];
}) {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>(initialDoctors);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const showToast = useCallback((msg: string) => setSuccessMessage(msg), []);
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    setDoctors(initialDoctors);
  }, [initialDoctors]);

  useEffect(() => {
    if (showAdd) setAddErrors({});
  }, [showAdd]);
  useEffect(() => {
    if (editing) setEditErrors({});
  }, [editing]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddErrors({});
    const form = e.currentTarget;
    const name = (form.elements.namedItem("addName") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("addEmail") as HTMLInputElement).value.trim().toLowerCase();
    const password = (form.elements.namedItem("addPassword") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("addConfirmPassword") as HTMLInputElement).value;
    const err: Record<string, string> = {};
    if (!name) err.addName = "Name is required.";
    if (!email) err.addEmail = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.addEmail = "Please enter a valid email.";
    if (password.length < 8) err.addPassword = "Password must be at least 8 characters.";
    if (password !== confirm) err.addConfirmPassword = "Passwords do not match.";
    if (Object.keys(err).length) {
      setAddErrors(err);
      return;
    }
    setLoadingAdd(true);
    try {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddErrors({ form: (data.error as string) || "Failed to add doctor." });
        return;
      }
      setShowAdd(false);
      form.reset();
      showToast("Doctor added. They can sign in with this email and password.");
      router.refresh();
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>, doctor: Doctor) => {
    e.preventDefault();
    setEditErrors({});
    const form = e.currentTarget;
    const name = (form.elements.namedItem("editName") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("editEmail") as HTMLInputElement).value.trim().toLowerCase();
    const password = (form.elements.namedItem("editPassword") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("editConfirmPassword") as HTMLInputElement).value;
    const err: Record<string, string> = {};
    if (!name) err.editName = "Name is required.";
    if (!email) err.editEmail = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.editEmail = "Please enter a valid email.";
    if (password.length > 0) {
      if (password.length < 8) err.editPassword = "Password must be at least 8 characters.";
      else if (password !== confirm) err.editConfirmPassword = "Passwords do not match.";
    }
    if (Object.keys(err).length) {
      setEditErrors(err);
      return;
    }
    setLoadingEditId(doctor.id);
    try {
      const body: { name: string; email: string; password?: string } = { name, email };
      if (password) body.password = password;
      const res = await fetch(`/api/doctors/${doctor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditErrors({ form: (data.error as string) || "Failed to update doctor." });
        return;
      }
      setEditing(null);
      showToast("Doctor updated.");
      router.refresh();
    } finally {
      setLoadingEditId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setLoadingDeleteId(deletingId);
    try {
      const res = await fetch(`/api/doctors/${deletingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data.error as string) || "Failed to remove doctor.");
        return;
      }
      setDeletingId(null);
      showToast("Doctor removed.");
      router.refresh();
    } finally {
      setLoadingDeleteId(null);
    }
  };

  return (
    <div>
      <Toast message={successMessage ?? ""} />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--dec-base)] sm:text-3xl">
          Doctors
        </h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
        >
          Add doctor
        </button>
      </div>

      <p className="mb-6 text-sm text-[var(--dec-muted)]">
        Manage doctor logins. New doctors can sign in with the email and password you set. Appointments can be assigned to them from the Appointments page.
      </p>

      {doctors.length === 0 ? (
        <div className="dec-card-container border border-[var(--dec-border)] p-8 text-center">
          <p className="text-[var(--dec-muted)]">No doctors yet.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
          >
            Add your first doctor
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {doctors.map((d) => (
            <li
              key={d.id}
              className="dec-card-container flex flex-wrap items-center justify-between gap-4 border border-[var(--dec-border)] p-5"
            >
              <div>
                <p className="font-medium text-[var(--dec-text)]">{d.name ?? "—"}</p>
                <p className="text-sm text-[var(--dec-muted)]">{d.email ?? "—"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(d)}
                  disabled={!!loadingEditId || !!loadingDeleteId}
                  className="rounded-lg bg-[var(--dec-base)]/10 px-3 py-1.5 text-sm font-medium text-[var(--dec-base)] transition hover:bg-[var(--dec-base)]/20 disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(d.id)}
                  disabled={!!loadingEditId || !!loadingDeleteId}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--dec-error)] transition hover:bg-red-50 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add doctor modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !loadingAdd && setShowAdd(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-doctor-title"
        >
          <div
            className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-doctor-title" className="mb-6 text-xl font-semibold text-[var(--dec-base)]">
              Add doctor
            </h2>
            {addErrors.form && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
                {addErrors.form}
              </p>
            )}
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div>
                <label htmlFor="addName" className={labelClass}>Name</label>
                <input
                  id="addName"
                  name="addName"
                  type="text"
                  autoComplete="name"
                  required
                  className={addErrors.addName ? inputErrorClass : inputClass}
                  aria-invalid={!!addErrors.addName}
                />
                {addErrors.addName && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addErrors.addName}</p>
                )}
              </div>
              <div>
                <label htmlFor="addEmail" className={labelClass}>Email (sign-in)</label>
                <input
                  id="addEmail"
                  name="addEmail"
                  type="email"
                  autoComplete="email"
                  required
                  className={addErrors.addEmail ? inputErrorClass : inputClass}
                  aria-invalid={!!addErrors.addEmail}
                />
                {addErrors.addEmail && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addErrors.addEmail}</p>
                )}
              </div>
              <div>
                <label htmlFor="addPassword" className={labelClass}>Password</label>
                <input
                  id="addPassword"
                  name="addPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={addErrors.addPassword ? inputErrorClass : inputClass}
                  aria-invalid={!!addErrors.addPassword}
                />
                {addErrors.addPassword && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addErrors.addPassword}</p>
                )}
                <p className="mt-1 text-xs text-[var(--dec-muted)]">At least 8 characters.</p>
              </div>
              <div>
                <label htmlFor="addConfirmPassword" className={labelClass}>Confirm password</label>
                <input
                  id="addConfirmPassword"
                  name="addConfirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={addErrors.addConfirmPassword ? inputErrorClass : inputClass}
                  aria-invalid={!!addErrors.addConfirmPassword}
                />
                {addErrors.addConfirmPassword && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addErrors.addConfirmPassword}</p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loadingAdd}
                  className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
                >
                  {loadingAdd ? "Adding…" : "Add doctor"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={loadingAdd}
                  className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit doctor modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !loadingEditId && setEditing(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-doctor-title"
        >
          <div
            className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-doctor-title" className="mb-6 text-xl font-semibold text-[var(--dec-base)]">
              Edit doctor
            </h2>
            {editErrors.form && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
                {editErrors.form}
              </p>
            )}
            <form onSubmit={(e) => handleEdit(e, editing)} className="flex flex-col gap-4">
              <div>
                <label htmlFor="editName" className={labelClass}>Name</label>
                <input
                  id="editName"
                  name="editName"
                  type="text"
                  autoComplete="name"
                  required
                  defaultValue={editing.name ?? ""}
                  className={editErrors.editName ? inputErrorClass : inputClass}
                  aria-invalid={!!editErrors.editName}
                />
                {editErrors.editName && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{editErrors.editName}</p>
                )}
              </div>
              <div>
                <label htmlFor="editEmail" className={labelClass}>Email (sign-in)</label>
                <input
                  id="editEmail"
                  name="editEmail"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={editing.email ?? ""}
                  className={editErrors.editEmail ? inputErrorClass : inputClass}
                  aria-invalid={!!editErrors.editEmail}
                />
                {editErrors.editEmail && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{editErrors.editEmail}</p>
                )}
              </div>
              <div>
                <label htmlFor="editPassword" className={labelClass}>New password (leave blank to keep current)</label>
                <input
                  id="editPassword"
                  name="editPassword"
                  type="password"
                  autoComplete="new-password"
                  className={editErrors.editPassword ? inputErrorClass : inputClass}
                  aria-invalid={!!editErrors.editPassword}
                />
                {editErrors.editPassword && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{editErrors.editPassword}</p>
                )}
                <p className="mt-1 text-xs text-[var(--dec-muted)]">At least 8 characters if changing.</p>
              </div>
              <div>
                <label htmlFor="editConfirmPassword" className={labelClass}>Confirm new password</label>
                <input
                  id="editConfirmPassword"
                  name="editConfirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={editErrors.editConfirmPassword ? inputErrorClass : inputClass}
                  aria-invalid={!!editErrors.editConfirmPassword}
                />
                {editErrors.editConfirmPassword && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{editErrors.editConfirmPassword}</p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loadingEditId === editing.id}
                  className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
                >
                  {loadingEditId === editing.id ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={loadingEditId === editing.id}
                  className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !loadingDeleteId && setDeletingId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-doctor-title"
        >
          <div
            className="dec-card-container w-full max-w-sm border border-[var(--dec-border)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-doctor-title" className="text-lg font-semibold text-[var(--dec-base)]">
              Remove this doctor?
            </h2>
            <p className="mt-2 text-sm text-[var(--dec-muted)]">
              They will no longer be able to sign in. Appointments assigned to them will be unassigned (no appointment data is deleted).
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loadingDeleteId === deletingId}
                className="rounded-full bg-[var(--dec-error)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {loadingDeleteId === deletingId ? "Removing…" : "Yes, remove"}
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={!!loadingDeleteId}
                className="rounded-full border border-[var(--dec-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
