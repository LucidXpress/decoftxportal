"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "./Toast";
import { isPastDate, isValidOptionalUrl } from "@/lib/validation";

type Doctor = { id: string; name: string | null; email: string | null };
type Appointment = {
  id: string;
  patientName: string;
  appointmentDate: string | Date;
  durationMinutes: number;
  examType: string;
  status: string;
  oneDriveLink: string | null;
  internalNotes: string | null;
  addedBy: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  assignedDoctor: Doctor | null;
};

function toDateTimeLocal(d: Date): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

type StatusFilter = "all" | "scheduled" | "completed" | "cancelled";
type DateFilter = "all" | "today";

export function ReceptionDashboard({
  appointments: initialAppointments,
  doctors,
}: {
  appointments: Appointment[];
  doctors: Doctor[];
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [loadingStatusId, setLoadingStatusId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const editModalRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setSuccessMessage(msg);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (editingId) setFormErrors({});
  }, [editingId]);

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((a) => a.patientName.toLowerCase().includes(q));
    }
    if (dateFilter === "today") {
      const start = startOfToday().getTime();
      const end = endOfToday().getTime();
      list = list.filter((a) => {
        const t = new Date(a.appointmentDate).getTime();
        return t >= start && t <= end;
      });
    }
    return list;
  }, [appointments, statusFilter, searchQuery, dateFilter]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormErrors({});
    const form = e.currentTarget;
    const patientName = (form.elements.namedItem("patientName") as HTMLInputElement).value.trim();
    const addedBy = (form.elements.namedItem("addedBy") as HTMLInputElement).value.trim();
    const appointmentDateValue = (form.elements.namedItem("appointmentDate") as HTMLInputElement).value;
    const oneDriveLinkValue = (form.elements.namedItem("oneDriveLink") as HTMLInputElement).value.trim();

    const errors: Record<string, string> = {};
    if (!patientName) errors.patientName = "Patient name is required.";
    if (!addedBy) errors.addedBy = "Added by is required.";
    const appointmentDate = appointmentDateValue ? new Date(appointmentDateValue) : null;
    if (appointmentDate && isPastDate(appointmentDate.toISOString())) {
      errors.appointmentDate = "Date & time cannot be in the past.";
    }
    if (oneDriveLinkValue && !isValidOptionalUrl(oneDriveLinkValue)) {
      errors.oneDriveLink = "Please enter a valid URL.";
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setLoadingCreate(true);
    try {
      const patientPhoneValue = (form.elements.namedItem("patientPhone") as HTMLInputElement)?.value.trim() || null;
      const patientEmailValue = (form.elements.namedItem("patientEmail") as HTMLInputElement)?.value.trim() || null;
      const data = {
        patientName,
        addedBy,
        patientPhone: patientPhoneValue,
        patientEmail: patientEmailValue,
        appointmentDate: appointmentDate!.toISOString(),
        durationMinutes: parseInt(
          (form.elements.namedItem("durationMinutes") as HTMLInputElement).value,
          10
        ),
        examType: (form.elements.namedItem("examType") as HTMLInputElement).value,
        oneDriveLink: oneDriveLinkValue || undefined,
        internalNotes: (form.elements.namedItem("internalNotes") as HTMLInputElement).value.trim() || undefined,
        assignedDoctorId: (form.elements.namedItem("assignedDoctorId") as HTMLSelectElement).value || null,
      };
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormErrors({ form: (err.error as string) ?? "Failed to create appointment." });
        return;
      }
      const created = await res.json();
      setAppointments((prev) =>
        [...prev, created].sort(
          (a, b) =>
            new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
        )
      );
      setShowForm(false);
      form.reset();
      showToast("Appointment created.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    setFormErrors({});
    const form = e.currentTarget;
    const patientName = (form.elements.namedItem("patientName") as HTMLInputElement).value.trim();
    const appointmentDateValue = (form.elements.namedItem("appointmentDate") as HTMLInputElement).value;
    const oneDriveLinkValue = (form.elements.namedItem("oneDriveLink") as HTMLInputElement).value.trim();

    const errors: Record<string, string> = {};
    if (!patientName) errors.patientName = "Patient name is required.";
    const appointmentDate = appointmentDateValue ? new Date(appointmentDateValue) : null;
    if (appointmentDate && isPastDate(appointmentDate.toISOString())) {
      errors.appointmentDate = "Date & time cannot be in the past.";
    }
    if (oneDriveLinkValue && !isValidOptionalUrl(oneDriveLinkValue)) {
      errors.oneDriveLink = "Please enter a valid URL.";
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setLoadingEditId(id);
    try {
      const patientPhoneValue = (form.elements.namedItem("patientPhone") as HTMLInputElement)?.value.trim() || null;
      const patientEmailValue = (form.elements.namedItem("patientEmail") as HTMLInputElement)?.value.trim() || null;
      const data = {
        patientName,
        appointmentDate: appointmentDate?.toISOString(),
        durationMinutes: parseInt(
          (form.elements.namedItem("durationMinutes") as HTMLInputElement).value,
          10
        ),
        examType: (form.elements.namedItem("examType") as HTMLInputElement).value,
        status: (form.elements.namedItem("status") as HTMLSelectElement).value as "scheduled" | "completed" | "cancelled",
        patientPhone: patientPhoneValue,
        patientEmail: patientEmailValue,
        oneDriveLink: oneDriveLinkValue || null,
        internalNotes: (form.elements.namedItem("internalNotes") as HTMLInputElement).value.trim() || null,
        assignedDoctorId: (form.elements.namedItem("assignedDoctorId") as HTMLSelectElement).value || null,
      };
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormErrors({ form: (err.error as string) ?? "Failed to update appointment." });
        return;
      }
      const updated = await res.json();
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? updated : a)).sort(
          (a, b) =>
            new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
        )
      );
      setEditingId(null);
      showToast("Appointment updated.");
    } finally {
      setLoadingEditId(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === "cancelled") {
      setCancelConfirmId(id);
      return;
    }
    setLoadingStatusId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      showToast("Appointment marked as completed.");
    } finally {
      setLoadingStatusId(null);
    }
  };

  const confirmCancelAppointment = async () => {
    if (!cancelConfirmId) return;
    const id = cancelConfirmId;
    setCancelConfirmId(null);
    setLoadingStatusId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      showToast("Appointment cancelled.");
    } finally {
      setLoadingStatusId(null);
    }
  };

  const editingAppointment = editingId
    ? appointments.find((a) => a.id === editingId)
    : null;

  // Escape to close edit modal
  useEffect(() => {
    if (!editingAppointment) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingAppointment]);

  // Escape to close cancel confirm
  useEffect(() => {
    if (!cancelConfirmId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setCancelConfirmId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelConfirmId]);

  // Modal focus: focus first focusable when edit modal opens; trap focus; return focus on close
  useEffect(() => {
    if (!editingAppointment || !editModalRef.current) return;
    const modal = editModalRef.current;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    if (first) {
      (first as HTMLInputElement).focus?.();
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      const current = document.activeElement;
      const last = focusable[focusable.length - 1];
      const firstEl = focusable[0];
      if (e.shiftKey) {
        if (current === firstEl) {
          e.preventDefault();
          (last as HTMLElement).focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          (firstEl as HTMLElement).focus();
        }
      }
    };
    modal.addEventListener("keydown", onKeyDown);
    return () => {
      modal.removeEventListener("keydown", onKeyDown);
      editTriggerRef.current?.focus?.();
    };
  }, [editingAppointment]);

  const inputClass =
    "w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2.5 text-[var(--dec-text)] transition-[box-shadow,border-color] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20";
  const inputErrorClass =
    "w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-error)] bg-white px-3 py-2.5 text-[var(--dec-text)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20";
  const labelClass = "mb-1.5 block text-sm font-medium text-[var(--dec-text)]";

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div>
      <Toast message={successMessage ?? ""} />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--dec-base)] sm:text-3xl">
          Appointments
        </h1>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
          >
            {showForm ? "Cancel" : "New appointment"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="dec-card-container mb-8 border border-[var(--dec-border)] p-6 sm:p-8"
        >
          <h2 className="mb-6 text-xl font-semibold text-[var(--dec-base)]">
            New appointment
          </h2>
          {formErrors.form && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
              {formErrors.form}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Patient name</label>
              <input
                name="patientName"
                required
                className={formErrors.patientName ? inputErrorClass : inputClass}
                aria-invalid={!!formErrors.patientName}
                aria-describedby={formErrors.patientName ? "create-err-patientName" : undefined}
              />
              {formErrors.patientName && (
                <p id="create-err-patientName" className="mt-1 text-sm text-[var(--dec-error)]">
                  {formErrors.patientName}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Added by</label>
              <input
                name="addedBy"
                type="text"
                required
                placeholder="Your name"
                className={formErrors.addedBy ? inputErrorClass : inputClass}
                aria-invalid={!!formErrors.addedBy}
                aria-describedby={formErrors.addedBy ? "create-err-addedBy" : undefined}
              />
              {formErrors.addedBy && (
                <p id="create-err-addedBy" className="mt-1 text-sm text-[var(--dec-error)]">
                  {formErrors.addedBy}
                </p>
              )}
              <p className="mt-1 text-xs text-[var(--dec-muted)]">
                Who is adding this appointment (for the team to see).
              </p>
            </div>
            <div>
              <label className={labelClass}>Date & time</label>
              <input
                name="appointmentDate"
                type="datetime-local"
                required
                className={formErrors.appointmentDate ? inputErrorClass : inputClass}
                aria-invalid={!!formErrors.appointmentDate}
                aria-describedby={formErrors.appointmentDate ? "create-err-appointmentDate" : undefined}
              />
              {formErrors.appointmentDate && (
                <p id="create-err-appointmentDate" className="mt-1 text-sm text-[var(--dec-error)]">
                  {formErrors.appointmentDate}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Duration (minutes)</label>
              <input name="durationMinutes" type="number" min={5} max={480} defaultValue={60} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Exam type</label>
              <input name="examType" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Assign doctor</label>
              <select name="assignedDoctorId" className={inputClass}>
                <option value="">— Select —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? d.email}</option>
                ))}
              </select>
              {doctors.length === 0 && (
                <p className="mt-1 text-xs text-[var(--dec-muted)]">
                  No doctors yet. Go to <strong>Doctors</strong> in the header to add doctor logins.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Patient email (optional)</label>
              <input
                name="patientEmail"
                type="email"
                placeholder="patient@example.com"
                className={formErrors.patientEmail ? inputErrorClass : inputClass}
                aria-invalid={!!formErrors.patientEmail}
                aria-describedby={formErrors.patientEmail ? "create-err-patientEmail" : "create-desc-patientEmail"}
              />
              {formErrors.patientEmail && (
                <p id="create-err-patientEmail" className="mt-1 text-sm text-[var(--dec-error)]">
                  {formErrors.patientEmail}
                </p>
              )}
              <p id="create-desc-patientEmail" className="mt-1 text-xs text-[var(--dec-muted)]">
                Patient will receive an email confirmation when the appointment is created.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Patient phone (optional)</label>
              <input
                name="patientPhone"
                type="tel"
                placeholder="(555) 123-4567"
                className={inputClass}
                aria-describedby="create-desc-patientPhone"
              />
              <p id="create-desc-patientPhone" className="mt-1 text-xs text-[var(--dec-muted)]">
                Patient will receive an SMS confirmation when the appointment is created (requires Twilio).
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>OneDrive link (optional)</label>
              <input
                name="oneDriveLink"
                type="url"
                placeholder="https://..."
                className={formErrors.oneDriveLink ? inputErrorClass : inputClass}
                aria-invalid={!!formErrors.oneDriveLink}
                aria-describedby={formErrors.oneDriveLink ? "create-err-oneDriveLink" : undefined}
              />
              {formErrors.oneDriveLink && (
                <p id="create-err-oneDriveLink" className="mt-1 text-sm text-[var(--dec-error)]">
                  {formErrors.oneDriveLink}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Internal notes (optional)</label>
              <textarea name="internalNotes" rows={2} className={inputClass} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loadingCreate}
              className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
            >
              {loadingCreate ? "Creating…" : "Create appointment"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={loadingCreate}
              className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {appointments.length > 0 && (
        <>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {statusTabs.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  statusFilter === value
                    ? "bg-[var(--dec-base)] text-white"
                    : "bg-[var(--dec-light-soft)] text-[var(--dec-text)] hover:bg-[var(--dec-light)]/60"
                }`}
              >
                {label}
              </button>
            ))}
            <div className="h-6 w-px bg-[var(--dec-border)]" />
            <button
              type="button"
              onClick={() => setDateFilter((d) => (d === "today" ? "all" : "today"))}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                dateFilter === "today"
                  ? "bg-[var(--dec-base)] text-white"
                  : "bg-[var(--dec-light-soft)] text-[var(--dec-text)] hover:bg-[var(--dec-light)]/60"
              }`}
            >
              Today
            </button>
          </div>
          <input
            type="search"
            placeholder="Search by patient name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2 text-sm text-[var(--dec-text)] placeholder:text-[var(--dec-muted)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20 sm:max-w-xs"
            aria-label="Search by patient name"
          />
        </div>
        <p className="mb-4 text-sm text-[var(--dec-muted)]">
          {filteredAppointments.length === appointments.length
            ? `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`
            : `Showing ${filteredAppointments.length} of ${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`}
        </p>
        </>
      )}

      {appointments.length === 0 ? (
        <div className="dec-card-container border border-[var(--dec-border)] p-8 text-center">
          <p className="text-[var(--dec-muted)]">No appointments yet.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
          >
            Create your first appointment
          </button>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="dec-card-container border border-[var(--dec-border)] p-8 text-center">
          <p className="text-[var(--dec-muted)]">No appointments match the current filters.</p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setDateFilter("all");
              setSearchQuery("");
            }}
            className="mt-4 rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredAppointments.map((apt) => (
            <li
              key={apt.id}
              className="dec-appointment-card border border-[var(--dec-border)] border-l-4 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--dec-text)]">{apt.patientName}</p>
                  <p className="mt-0.5 text-sm text-[var(--dec-muted)]">
                    {formatDate(apt.appointmentDate)} · {apt.durationMinutes} min
                  </p>
                  <p className="text-sm text-[var(--dec-text)]">{apt.examType}</p>
                  <p className="text-sm text-[var(--dec-muted)]">
                    Doctor: {apt.assignedDoctor?.name ?? apt.assignedDoctor?.email ?? "—"}
                  </p>
                  <p className="text-sm text-[var(--dec-muted)]">
                    Added by: {apt.addedBy ?? "—"}
                  </p>
                  {apt.patientEmail && (
                    <p className="text-sm text-[var(--dec-muted)]">
                      Patient email: {apt.patientEmail}
                    </p>
                  )}
                  {apt.patientPhone && (
                    <p className="text-sm text-[var(--dec-muted)]">
                      Patient phone: {apt.patientPhone}
                    </p>
                  )}
                  {apt.internalNotes && (
                    <p className="mt-1 text-sm text-[var(--dec-muted)]">{apt.internalNotes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      apt.status === "completed"
                        ? "bg-[var(--dec-light-soft)] text-[var(--dec-base)]"
                        : apt.status === "cancelled"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-[var(--dec-light)]/80 text-[var(--dec-base)]"
                    }`}
                  >
                    {apt.status}
                  </span>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      ref={(el) => {
                        if (editingId === apt.id) editTriggerRef.current = el;
                      }}
                      type="button"
                      onClick={() => setEditingId(apt.id)}
                      disabled={!!loadingEditId || !!loadingStatusId}
                      className="rounded-lg bg-[var(--dec-base)]/10 px-3 py-1.5 text-sm font-medium text-[var(--dec-base)] transition hover:bg-[var(--dec-base)]/20 disabled:opacity-60"
                    >
                      Edit appointment
                    </button>
                    {apt.oneDriveLink && (
                      <a
                        href={apt.oneDriveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--dec-base)] transition hover:bg-[var(--dec-base)]/10"
                      >
                        Open OneDrive
                      </a>
                    )}
                    {apt.status === "scheduled" && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateStatus(apt.id, "completed")}
                          disabled={loadingStatusId === apt.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                        >
                          {loadingStatusId === apt.id ? "…" : "Mark completed"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(apt.id, "cancelled")}
                          disabled={loadingStatusId === apt.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dec-error)] transition hover:bg-red-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Cancel confirmation modal */}
      {cancelConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => setCancelConfirmId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-confirm-title"
        >
          <div
            className="dec-card-container w-full max-w-sm border border-[var(--dec-border)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-confirm-title" className="text-lg font-semibold text-[var(--dec-base)]">
              Cancel this appointment?
            </h2>
            <p className="mt-2 text-sm text-[var(--dec-muted)]">
              This will mark the appointment as cancelled. You can change the status back in Edit if needed.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={confirmCancelAppointment}
                disabled={loadingStatusId === cancelConfirmId}
                className="rounded-full bg-[var(--dec-error)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {loadingStatusId === cancelConfirmId ? "Cancelling…" : "Yes, cancel appointment"}
              </button>
              <button
                type="button"
                onClick={() => setCancelConfirmId(null)}
                className="rounded-full border border-[var(--dec-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => setEditingId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Edit appointment"
        >
          <div
            ref={editModalRef}
            className="dec-card-container max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--dec-border)] p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-6 text-xl font-semibold text-[var(--dec-base)]">
              Edit appointment
            </h2>
            {formErrors.form && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
                {formErrors.form}
              </p>
            )}
            <form
              onSubmit={(e) => handleEditSubmit(e, editingAppointment.id)}
              className="flex flex-col gap-4"
            >
              <div>
                <label className={labelClass}>Patient name</label>
                <input
                  name="patientName"
                  required
                  defaultValue={editingAppointment.patientName}
                  className={formErrors.patientName ? inputErrorClass : inputClass}
                  aria-invalid={!!formErrors.patientName}
                />
                {formErrors.patientName && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{formErrors.patientName}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Date & time</label>
                <input
                  name="appointmentDate"
                  type="datetime-local"
                  required
                  defaultValue={toDateTimeLocal(new Date(editingAppointment.appointmentDate))}
                  className={formErrors.appointmentDate ? inputErrorClass : inputClass}
                  aria-invalid={!!formErrors.appointmentDate}
                />
                {formErrors.appointmentDate && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{formErrors.appointmentDate}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Duration (minutes)</label>
                <input
                  name="durationMinutes"
                  type="number"
                  min={5}
                  max={480}
                  defaultValue={editingAppointment.durationMinutes}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Exam type</label>
                <input
                  name="examType"
                  required
                  defaultValue={editingAppointment.examType}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select name="status" defaultValue={editingAppointment.status} className={inputClass}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <span className={labelClass}>Added by</span>
                <p className="mt-0.5 text-sm text-[var(--dec-muted)]">
                  {editingAppointment.addedBy ?? "—"}
                </p>
              </div>
              <div>
                <label className={labelClass}>Assign doctor</label>
                <select
                  name="assignedDoctorId"
                  defaultValue={editingAppointment.assignedDoctor?.id ?? ""}
                  className={inputClass}
                >
                  <option value="">— No doctor —</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name ?? d.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Patient email (optional)</label>
                <input
                  name="patientEmail"
                  type="email"
                  placeholder="patient@example.com"
                  defaultValue={editingAppointment.patientEmail ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Patient phone (optional)</label>
                <input
                  name="patientPhone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  defaultValue={editingAppointment.patientPhone ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>OneDrive link (optional)</label>
                <input
                  name="oneDriveLink"
                  type="url"
                  placeholder="https://..."
                  defaultValue={editingAppointment.oneDriveLink ?? ""}
                  className={formErrors.oneDriveLink ? inputErrorClass : inputClass}
                  aria-invalid={!!formErrors.oneDriveLink}
                />
                {formErrors.oneDriveLink && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{formErrors.oneDriveLink}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Internal notes (optional)</label>
                <textarea
                  name="internalNotes"
                  rows={2}
                  defaultValue={editingAppointment.internalNotes ?? ""}
                  className={inputClass}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loadingEditId === editingAppointment.id}
                  className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
                >
                  {loadingEditId === editingAppointment.id ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
