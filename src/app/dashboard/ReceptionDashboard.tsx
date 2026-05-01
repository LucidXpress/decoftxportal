"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "./Toast";
import { isPastDate, isValidOptionalUrl } from "@/lib/validation";

type Doctor = { id: string; name: string | null; email: string | null };
type SavedAddress = { id: string; streetAddress: string; city: string; state: string };
type SavedExamType = { id: string; name: string };
type CreateAppointmentPayload = {
  patientName: string;
  addedBy: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  appointmentDate: string;
  examType: string;
  oneDriveLink?: string;
  internalNotes?: string;
  assignedDoctorId: string | null;
  allowDuplicate?: boolean;
};
type DuplicateWarning = {
  id: string;
  patientName: string;
  appointmentDate: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  doctorName: string | null;
};
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
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  assignedDoctor: Doctor | null;
};

function snapDateToQuarterHour(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const remainder = minutes % 15;
  if (remainder >= 8) {
    snapped.setMinutes(minutes + (15 - remainder), 0, 0);
  } else {
    snapped.setMinutes(minutes - remainder, 0, 0);
  }
  return snapped;
}

function toDateInputValue(d: Date): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInputValue(d: Date): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const hour12 = h % 12 || 12;
  const meridiem = h >= 12 ? "PM" : "AM";
  return `${hour12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

type StatusFilter = "all" | "scheduled" | "completed" | "cancelled";
const ADD_ADDRESS_OPTION = "__add_new_address__";
const ADD_EXAM_TYPE_OPTION = "__add_new_exam_type__";
const QUARTER_HOUR_TIMES = Array.from({ length: (18 - 8) * 4 + 1 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

export function ReceptionDashboard({
  appointments: initialAppointments,
  doctors,
  savedAddresses: initialSavedAddresses,
  savedExamTypes: initialSavedExamTypes,
}: {
  appointments: Appointment[];
  doctors: Doctor[];
  savedAddresses: SavedAddress[];
  savedExamTypes: SavedExamType[];
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(initialSavedAddresses);
  const [savedExamTypes, setSavedExamTypes] = useState<SavedExamType[]>(initialSavedExamTypes);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedExamTypeId, setSelectedExamTypeId] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingAddAddress, setLoadingAddAddress] = useState(false);
  const [loadingAddExamType, setLoadingAddExamType] = useState(false);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [loadingStatusId, setLoadingStatusId] = useState<string | null>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [showAddExamType, setShowAddExamType] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState("");
  const [doctorFilterId, setDoctorFilterId] = useState("all");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [addAddressErrors, setAddAddressErrors] = useState<Record<string, string>>({});
  const [addExamTypeErrors, setAddExamTypeErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<CreateAppointmentPayload | null>(null);
  const [creatingDuplicateOverride, setCreatingDuplicateOverride] = useState(false);
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

  useEffect(() => {
    setSavedAddresses(initialSavedAddresses);
  }, [initialSavedAddresses]);

  useEffect(() => {
    setSavedExamTypes(initialSavedExamTypes);
  }, [initialSavedExamTypes]);

  const applySavedAddress = (addressId: string) => {
    if (addressId === ADD_ADDRESS_OPTION) {
      setAddAddressErrors({});
      setShowAddAddress(true);
      return;
    }
    setSelectedAddressId(addressId);
    if (!addressId) {
      setStreetAddress("");
      setCity("");
      setState("");
      return;
    }
    const selected = savedAddresses.find((address) => address.id === addressId);
    if (!selected) return;
    setStreetAddress(selected.streetAddress ?? "");
    setCity(selected.city ?? "");
    setState(selected.state ?? "");
  };

  const applySavedExamType = (examTypeId: string) => {
    if (examTypeId === ADD_EXAM_TYPE_OPTION) {
      setAddExamTypeErrors({});
      setShowAddExamType(true);
      return;
    }
    setSelectedExamTypeId(examTypeId);
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((a) => a.patientName.toLowerCase().includes(q));
    }
    if (doctorFilterId !== "all") {
      list = list.filter((a) => a.assignedDoctor?.id === doctorFilterId);
    }
    if (selectedDateFilter) {
      list = list.filter((a) => {
        const d = new Date(a.appointmentDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}` === selectedDateFilter;
      });
    }
    return list;
  }, [appointments, statusFilter, searchQuery, selectedDateFilter, doctorFilterId]);

  const handleDownloadSchedule = () => {
    const listed = [...filteredAppointments].sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    );
    if (listed.length === 0) {
      showToast("No appointments to export.");
      return;
    }

    const doctorTitle =
      doctorFilterId === "all"
        ? "ALL DOCTORS"
        : (doctors.find((d) => d.id === doctorFilterId)?.name ?? "SELECTED DOCTOR").toUpperCase();
    const headerDateSource =
      selectedDateFilter && selectedDateFilter.length > 0
        ? new Date(`${selectedDateFilter}T00:00:00`)
        : new Date(listed[0].appointmentDate);
    const dateTitle = headerDateSource
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase();
    const cityValues = Array.from(new Set(listed.map((apt) => (apt.city ?? "").trim()).filter(Boolean)));
    const locationTitle = (cityValues.length === 1 ? cityValues[0] : "MULTIPLE LOCATIONS").toUpperCase();
    const titleLine = `${dateTitle} \u2014 ${doctorTitle} \u2014 ${locationTitle}`;

    const rowsHtml = listed
      .map((apt) => {
        const timeLabel = new Date(apt.appointmentDate).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        return `
          <div style="display:flex;gap:26px;margin:0 0 14px 0;font-size:36px;line-height:1.2;">
            <span style="min-width:170px;display:inline-block;">${escapeHtml(timeLabel)}</span>
            <span>${escapeHtml(apt.patientName).toUpperCase()}</span>
          </div>
        `;
      })
      .join("");

    const htmlDoc = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Appointment Schedule</title>
        </head>
        <body style="font-family:Arial,sans-serif;color:#111827;margin:0;padding:70px 85px 80px 85px;">
          <h1 style="margin:0 0 40px 0;font-size:30px;line-height:1.2;font-weight:700;text-decoration:underline;letter-spacing:0.2px;">
            ${escapeHtml(titleLine)}
          </h1>
          <div>
            ${rowsHtml}
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlDoc], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeDate = selectedDateFilter || new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `appointment-schedule-${safeDate}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const finishCreateSuccess = (created: Appointment) => {
    setAppointments((prev) =>
      [...prev, created].sort(
        (a, b) =>
          new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
      )
    );
    setShowForm(false);
    setSelectedAddressId("");
    setSelectedExamTypeId("");
    setStreetAddress("");
    setCity("");
    setState("");
    setPendingCreatePayload(null);
    setDuplicateWarning(null);
    showToast("Appointment created.");
  };

  const createAppointment = async (payload: CreateAppointmentPayload) => {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 409 && body.code === "DUPLICATE_APPOINTMENT") {
        setPendingCreatePayload(payload);
        setDuplicateWarning((body.duplicate as DuplicateWarning) ?? null);
        return;
      }
      setFormErrors({ form: (body.error as string) ?? "Failed to create appointment." });
      return;
    }

    finishCreateSuccess(body as Appointment);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormErrors({});
    const form = e.currentTarget;
    const patientName = (form.elements.namedItem("patientName") as HTMLInputElement).value.trim();
    const addedBy = (form.elements.namedItem("addedBy") as HTMLInputElement).value.trim();
    const streetAddressValue = streetAddress.trim();
    const cityValue = city.trim();
    const stateValue = state.trim();
    const appointmentDateDayValue = (form.elements.namedItem("appointmentDateDay") as HTMLInputElement).value;
    const appointmentTimeValue = (form.elements.namedItem("appointmentTime") as HTMLSelectElement).value;
    const oneDriveLinkValue = (form.elements.namedItem("oneDriveLink") as HTMLInputElement).value.trim();

    const errors: Record<string, string> = {};
    if (!patientName) errors.patientName = "Patient name is required.";
    if (!addedBy) errors.addedBy = "Added by is required.";
    const appointmentDate =
      appointmentDateDayValue && appointmentTimeValue
        ? new Date(`${appointmentDateDayValue}T${appointmentTimeValue}`)
        : null;
    if (appointmentDate && isPastDate(appointmentDate.toISOString())) {
      errors.appointmentDate = "Date & time cannot be in the past.";
    }
    if (oneDriveLinkValue && !isValidOptionalUrl(oneDriveLinkValue)) {
      errors.oneDriveLink = "Please enter a valid URL.";
    }
    if (!selectedExamTypeId) {
      errors.examType = "Exam type is required.";
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    const patientPhoneValue = (form.elements.namedItem("patientPhone") as HTMLInputElement)?.value.trim() || null;
    const patientEmailValue = (form.elements.namedItem("patientEmail") as HTMLInputElement)?.value.trim() || null;
    const payload: CreateAppointmentPayload = {
      patientName,
      addedBy,
      streetAddress: streetAddressValue || null,
      city: cityValue || null,
      state: stateValue || null,
      patientPhone: patientPhoneValue,
      patientEmail: patientEmailValue,
      appointmentDate: appointmentDate!.toISOString(),
      examType: savedExamTypes.find((item) => item.id === selectedExamTypeId)?.name ?? "",
      oneDriveLink: oneDriveLinkValue || undefined,
      internalNotes: (form.elements.namedItem("internalNotes") as HTMLInputElement).value.trim() || undefined,
      assignedDoctorId: (form.elements.namedItem("assignedDoctorId") as HTMLSelectElement).value || null,
    };

    setLoadingCreate(true);
    try {
      await createAppointment(payload);
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleDuplicateProceed = async () => {
    if (!pendingCreatePayload) return;
    setCreatingDuplicateOverride(true);
    setFormErrors({});
    try {
      await createAppointment({ ...pendingCreatePayload, allowDuplicate: true });
    } finally {
      setCreatingDuplicateOverride(false);
    }
  };

  const handleAddExamType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddExamTypeErrors({});
    const form = e.currentTarget;
    const name = (form.elements.namedItem("examTypeName") as HTMLInputElement).value.trim();
    if (!name) {
      setAddExamTypeErrors({ examTypeName: "Exam type is required." });
      return;
    }

    setLoadingAddExamType(true);
    try {
      const res = await fetch("/api/exam-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddExamTypeErrors({ form: (data.error as string) || "Failed to save exam type." });
        return;
      }
      const created = data as SavedExamType;
      const safeCreated: SavedExamType = {
        id: created.id ?? "",
        name: created.name ?? "",
      };
      setSavedExamTypes((prev) =>
        [...prev, safeCreated].sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowAddExamType(false);
      form.reset();
      setSelectedExamTypeId(safeCreated.id);
      showToast("Exam type saved.");
    } finally {
      setLoadingAddExamType(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddAddressErrors({});
    const form = e.currentTarget;
    const streetAddressValue = (form.elements.namedItem("addressStreet") as HTMLInputElement).value.trim();
    const cityValue = (form.elements.namedItem("addressCity") as HTMLInputElement).value.trim();
    const stateValue = (form.elements.namedItem("addressState") as HTMLInputElement).value.trim();
    const errors: Record<string, string> = {};
    if (!streetAddressValue) errors.addressStreet = "Street address is required.";
    if (!cityValue) errors.addressCity = "City is required.";
    if (!stateValue) errors.addressState = "State is required.";
    if (Object.keys(errors).length) {
      setAddAddressErrors(errors);
      return;
    }

    setLoadingAddAddress(true);
    try {
      const res = await fetch("/api/clinic-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streetAddress: streetAddressValue,
          city: cityValue,
          state: stateValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddAddressErrors({ form: (data.error as string) || "Failed to save address." });
        return;
      }

      const created = data as SavedAddress;
      const safeCreated: SavedAddress = {
        id: created.id ?? "",
        streetAddress: created.streetAddress ?? "",
        city: created.city ?? "",
        state: created.state ?? "",
      };
      setSavedAddresses((prev) =>
        [...prev, safeCreated].sort((a, b) => a.streetAddress.localeCompare(b.streetAddress))
      );
      setShowAddAddress(false);
      form.reset();
      setSelectedAddressId(safeCreated.id);
      setStreetAddress(safeCreated.streetAddress);
      setCity(safeCreated.city);
      setState(safeCreated.state);
      showToast("Address saved.");
    } finally {
      setLoadingAddAddress(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    setFormErrors({});
    const form = e.currentTarget;
    const patientName = (form.elements.namedItem("patientName") as HTMLInputElement).value.trim();
    const streetAddressValue = (form.elements.namedItem("streetAddress") as HTMLInputElement).value.trim();
    const cityValue = (form.elements.namedItem("city") as HTMLInputElement).value.trim();
    const stateValue = (form.elements.namedItem("state") as HTMLInputElement).value.trim();
    const appointmentDateDayValue = (form.elements.namedItem("appointmentDateDay") as HTMLInputElement).value;
    const appointmentTimeValue = (form.elements.namedItem("appointmentTime") as HTMLSelectElement).value;
    const oneDriveLinkValue = (form.elements.namedItem("oneDriveLink") as HTMLInputElement).value.trim();

    const errors: Record<string, string> = {};
    if (!patientName) errors.patientName = "Patient name is required.";
    const appointmentDate =
      appointmentDateDayValue && appointmentTimeValue
        ? new Date(`${appointmentDateDayValue}T${appointmentTimeValue}`)
        : null;
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
        streetAddress: streetAddressValue || null,
        city: cityValue || null,
        state: stateValue || null,
        appointmentDate: appointmentDate?.toISOString(),
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

  const confirmDeleteAppointment = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setLoadingDeleteId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast((err.error as string) ?? "Failed to delete appointment.");
        return;
      }
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) setEditingId(null);
      router.refresh();
      showToast("Appointment deleted permanently.");
    } finally {
      setLoadingDeleteId(null);
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

  // Escape to close delete confirm
  useEffect(() => {
    if (!deleteConfirmId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDeleteConfirmId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmId]);

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
            onClick={handleDownloadSchedule}
            disabled={filteredAppointments.length === 0}
            className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
          >
            Download schedule
          </button>
          <button
            type="button"
            onClick={() =>
              setShowForm((v) => {
                const next = !v;
                if (!next) {
                  setDuplicateWarning(null);
                  setPendingCreatePayload(null);
                }
                return next;
              })
            }
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
            <div className="sm:col-span-2">
              <label className={labelClass}>Street address</label>
              <select
                name="streetAddress"
                value={selectedAddressId ?? ""}
                onChange={(e) => applySavedAddress(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select saved address —</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.streetAddress}
                  </option>
                ))}
                <option value={ADD_ADDRESS_OPTION}>+ Add address</option>
              </select>
              <p className="mt-1 text-xs text-[var(--dec-muted)]">
                Selecting a street address auto-fills city and state.
              </p>
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input
                name="city"
                type="text"
                placeholder="Austin"
                className={inputClass}
                value={city ?? ""}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                name="state"
                type="text"
                placeholder="TX"
                className={inputClass}
                value={state ?? ""}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Date & time</label>
              <div className="flex gap-2">
                <input
                  name="appointmentDateDay"
                  type="date"
                  required
                  className={formErrors.appointmentDate ? inputErrorClass : inputClass}
                  aria-invalid={!!formErrors.appointmentDate}
                  aria-describedby={formErrors.appointmentDate ? "create-err-appointmentDate" : undefined}
                />
                <select
                  name="appointmentTime"
                  required
                  className={formErrors.appointmentDate ? inputErrorClass : inputClass}
                  aria-invalid={!!formErrors.appointmentDate}
                >
                  <option value="">Time</option>
                  {QUARTER_HOUR_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {formatTimeLabel(time)}
                    </option>
                  ))}
                </select>
              </div>
              {formErrors.appointmentDate && (
                <p id="create-err-appointmentDate" className="mt-1 text-sm text-[var(--dec-error)]">
                  {formErrors.appointmentDate}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Exam type</label>
              <select
                name="examType"
                value={selectedExamTypeId ?? ""}
                onChange={(e) => applySavedExamType(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">— Select exam type —</option>
                {savedExamTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value={ADD_EXAM_TYPE_OPTION}>+ Add exam type</option>
              </select>
              {formErrors.examType && (
                <p className="mt-1 text-sm text-[var(--dec-error)]">{formErrors.examType}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Assign doctor</label>
              <select name="assignedDoctorId" className={inputClass}>
                <option value="">— Select —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? "Unnamed doctor"}</option>
                ))}
              </select>
              {doctors.length === 0 && (
                <p className="mt-1 text-xs text-[var(--dec-muted)]">
                  No doctors yet. Go to <strong>Doctors</strong> in the header to add one.
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
            <div>
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
              onClick={() => {
                setDuplicateWarning(null);
                setPendingCreatePayload(null);
                setShowForm(false);
              }}
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
        <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-1.5 text-sm text-[var(--dec-text)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20"
              aria-label="Filter by date"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-1.5 pr-8 text-sm text-[var(--dec-text)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={doctorFilterId}
              onChange={(e) => setDoctorFilterId(e.target.value)}
              className="rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-1.5 pr-8 text-sm text-[var(--dec-text)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20"
              aria-label="Filter by doctor"
            >
              <option value="all">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? "Unnamed doctor"}
                </option>
              ))}
            </select>
          </div>
          <input
            type="search"
            placeholder="Search by patient name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[var(--dec-radius-sm)] border border-[var(--dec-border)] bg-white px-3 py-2 text-sm text-[var(--dec-text)] placeholder:text-[var(--dec-muted)] focus:border-[var(--dec-base)] focus:outline-none focus:ring-2 focus:ring-[var(--dec-base)]/20 xl:w-[320px]"
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
              setSelectedDateFilter("");
              setDoctorFilterId("all");
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
                    Doctor: {apt.assignedDoctor?.name ?? "—"}
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
                      disabled={!!loadingEditId || !!loadingStatusId || !!loadingDeleteId}
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
                          disabled={loadingStatusId === apt.id || loadingDeleteId === apt.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                        >
                          {loadingStatusId === apt.id ? "…" : "Mark completed"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(apt.id, "cancelled")}
                          disabled={loadingStatusId === apt.id || loadingDeleteId === apt.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dec-error)] transition hover:bg-red-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(apt.id)}
                      disabled={!!loadingEditId || !!loadingStatusId || !!loadingDeleteId}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dec-error)] transition hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete permanently
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Duplicate warning modal */}
      {duplicateWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !creatingDuplicateOverride && setDuplicateWarning(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-warning-title"
        >
          <div
            className="dec-card-container w-full max-w-lg border border-[var(--dec-border)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="duplicate-warning-title" className="text-lg font-semibold text-[var(--dec-base)]">
              Possible duplicate appointment
            </h2>
            <p className="mt-3 text-sm text-[var(--dec-muted)]">
              An appointment for this claimant is already scheduled on{" "}
              <strong>{formatDate(duplicateWarning.appointmentDate)}</strong>{" "}
              at{" "}
              <strong>
                {[
                  duplicateWarning.streetAddress,
                  duplicateWarning.city,
                  duplicateWarning.state,
                ]
                  .filter(Boolean)
                  .join(", ") || "no location"}
              </strong>{" "}
              with{" "}
              <strong>{duplicateWarning.doctorName ?? "an unassigned doctor"}</strong>. This may be a duplicate.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDuplicateProceed}
                disabled={creatingDuplicateOverride}
                className="rounded-full bg-[var(--dec-base)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--dec-base-hover)] disabled:opacity-60"
              >
                {creatingDuplicateOverride ? "Creating..." : "Continue anyway"}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                disabled={creatingDuplicateOverride}
                className="rounded-full border border-[var(--dec-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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

      {/* Permanent delete confirmation modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !loadingDeleteId && setDeleteConfirmId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="dec-card-container w-full max-w-sm border border-[var(--dec-border)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-confirm-title" className="text-lg font-semibold text-[var(--dec-base)]">
              Delete this appointment permanently?
            </h2>
            <p className="mt-2 text-sm text-[var(--dec-muted)]">
              This action cannot be undone. The appointment will be permanently removed.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={confirmDeleteAppointment}
                disabled={loadingDeleteId === deleteConfirmId}
                className="rounded-full bg-[var(--dec-error)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {loadingDeleteId === deleteConfirmId ? "Deleting…" : "Yes, delete permanently"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={!!loadingDeleteId}
                className="rounded-full border border-[var(--dec-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddExamType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !loadingAddExamType && setShowAddExamType(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-exam-type-title"
        >
          <div
            className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-exam-type-title" className="mb-6 text-xl font-semibold text-[var(--dec-base)]">
              Add exam type
            </h2>
            {addExamTypeErrors.form && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
                {addExamTypeErrors.form}
              </p>
            )}
            <form onSubmit={handleAddExamType} className="flex flex-col gap-4">
              <div>
                <label htmlFor="examTypeName" className={labelClass}>Exam type name</label>
                <input
                  id="examTypeName"
                  name="examTypeName"
                  type="text"
                  className={addExamTypeErrors.examTypeName ? inputErrorClass : inputClass}
                  aria-invalid={!!addExamTypeErrors.examTypeName}
                />
                {addExamTypeErrors.examTypeName && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addExamTypeErrors.examTypeName}</p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loadingAddExamType}
                  className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
                >
                  {loadingAddExamType ? "Saving..." : "Save exam type"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddExamType(false)}
                  disabled={loadingAddExamType}
                  className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddAddress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
          onClick={() => !loadingAddAddress && setShowAddAddress(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-address-title"
        >
          <div
            className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-address-title" className="mb-6 text-xl font-semibold text-[var(--dec-base)]">
              Add saved address
            </h2>
            {addAddressErrors.form && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--dec-error)]">
                {addAddressErrors.form}
              </p>
            )}
            <form onSubmit={handleAddAddress} className="flex flex-col gap-4">
              <div>
                <label htmlFor="addressStreet" className={labelClass}>Street address</label>
                <input
                  id="addressStreet"
                  name="addressStreet"
                  type="text"
                  className={addAddressErrors.addressStreet ? inputErrorClass : inputClass}
                  aria-invalid={!!addAddressErrors.addressStreet}
                />
                {addAddressErrors.addressStreet && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addAddressErrors.addressStreet}</p>
                )}
              </div>
              <div>
                <label htmlFor="addressCity" className={labelClass}>City</label>
                <input
                  id="addressCity"
                  name="addressCity"
                  type="text"
                  className={addAddressErrors.addressCity ? inputErrorClass : inputClass}
                  aria-invalid={!!addAddressErrors.addressCity}
                />
                {addAddressErrors.addressCity && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addAddressErrors.addressCity}</p>
                )}
              </div>
              <div>
                <label htmlFor="addressState" className={labelClass}>State</label>
                <input
                  id="addressState"
                  name="addressState"
                  type="text"
                  className={addAddressErrors.addressState ? inputErrorClass : inputClass}
                  aria-invalid={!!addAddressErrors.addressState}
                />
                {addAddressErrors.addressState && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{addAddressErrors.addressState}</p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loadingAddAddress}
                  className="rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow disabled:opacity-60"
                >
                  {loadingAddAddress ? "Saving..." : "Save address"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAddress(false)}
                  disabled={loadingAddAddress}
                  className="rounded-full border border-[var(--dec-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
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
                <label className={labelClass}>Street address</label>
                <input
                  name="streetAddress"
                  type="text"
                  defaultValue={editingAppointment.streetAddress ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input name="city" type="text" defaultValue={editingAppointment.city ?? ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input name="state" type="text" defaultValue={editingAppointment.state ?? ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Date & time</label>
                <div className="flex gap-2">
                  <input
                    name="appointmentDateDay"
                    type="date"
                    required
                    defaultValue={toDateInputValue(new Date(editingAppointment.appointmentDate))}
                    className={formErrors.appointmentDate ? inputErrorClass : inputClass}
                    aria-invalid={!!formErrors.appointmentDate}
                  />
                  <select
                    name="appointmentTime"
                    required
                    defaultValue={toTimeInputValue(snapDateToQuarterHour(new Date(editingAppointment.appointmentDate)))}
                    className={formErrors.appointmentDate ? inputErrorClass : inputClass}
                    aria-invalid={!!formErrors.appointmentDate}
                  >
                    {QUARTER_HOUR_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </div>
                {formErrors.appointmentDate && (
                  <p className="mt-1 text-sm text-[var(--dec-error)]">{formErrors.appointmentDate}</p>
                )}
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
                    <option key={d.id} value={d.id}>{d.name ?? "Unnamed doctor"}</option>
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
