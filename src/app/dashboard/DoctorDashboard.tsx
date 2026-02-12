"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import type { Event } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./doctor-calendar.css";

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
  assignedDoctor: { id: string; name: string | null; email: string | null } | null;
};

type CalendarEvent = Event & { appointment?: Appointment };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

const messages = {
  date: "Date",
  time: "Time",
  event: "Appointment",
  allDay: "All Day",
  week: "Week",
  work_week: "Work Week",
  day: "Day",
  month: "Month",
  previous: "Back",
  next: "Next",
  yesterday: "Yesterday",
  tomorrow: "Tomorrow",
  today: "Today",
  agenda: "Agenda",
  noEventsInRange: "No appointments in this range.",
};

export function DoctorDashboard({
  appointments,
  userName,
}: {
  appointments: Appointment[];
  userName: string;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (!selectedEvent) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedEvent(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEvent]);

  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((apt) => {
      const start = new Date(apt.appointmentDate);
      const end = new Date(start.getTime() + apt.durationMinutes * 60 * 1000);
      return {
        id: apt.id,
        title: `${apt.patientName} · ${apt.examType}`,
        start,
        end,
        appointment: apt,
      };
    });
  }, [appointments]);

  return (
    <div>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-[var(--dec-base)] sm:text-3xl">
        My appointments
      </h1>
      {appointments.length === 0 ? (
        <div className="dec-card-container border border-[var(--dec-border)] p-8 text-center">
          <p className="text-[var(--dec-muted)]">No appointments assigned to you yet.</p>
        </div>
      ) : (
        <>
          <div className="doctor-calendar-wrapper h-[600px] rounded-[var(--dec-radius)] border border-[var(--dec-border)] bg-[var(--dec-white)] p-4 shadow-sm">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              titleAccessor="title"
              messages={messages}
              defaultView="month"
              views={["month", "week", "day", "agenda"]}
              eventPropGetter={() => ({
                style: {
                  backgroundColor: "var(--dec-base)",
                  border: "none",
                  color: "#fff",
                },
              })}
              onSelectEvent={(event) => setSelectedEvent(event as CalendarEvent)}
            />
          </div>

          {selectedEvent?.appointment && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dec-base)]/30 p-4 backdrop-blur-sm"
              onClick={() => setSelectedEvent(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Appointment details"
            >
              <div
                className="dec-card-container w-full max-w-md border border-[var(--dec-border)] p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-[var(--dec-base)]">
                  {selectedEvent.appointment.patientName}
                </h3>
                <p className="mt-1 text-sm text-[var(--dec-muted)]">
                  {selectedEvent.appointment.examType} ·{" "}
                  {selectedEvent.appointment.durationMinutes} min
                </p>
                <p className="mt-2 text-sm text-[var(--dec-text)]">
                  {format(new Date(selectedEvent.start!), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </p>
                {selectedEvent.appointment.addedBy && (
                  <p className="mt-1 text-sm text-[var(--dec-muted)]">
                    Added by: {selectedEvent.appointment.addedBy}
                  </p>
                )}
                {selectedEvent.appointment.internalNotes && (
                  <p className="mt-2 text-sm text-[var(--dec-muted)]">
                    {selectedEvent.appointment.internalNotes}
                  </p>
                )}
                {selectedEvent.appointment.oneDriveLink ? (
                  <a
                    href={selectedEvent.appointment.oneDriveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-full bg-[var(--dec-base)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--dec-base-hover)] hover:shadow"
                  >
                    Open records (OneDrive)
                  </a>
                ) : (
                  <p className="mt-4 text-sm text-[var(--dec-muted)]">No OneDrive link yet.</p>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="mt-4 w-full rounded-full border border-[var(--dec-border)] bg-white py-2.5 text-sm font-medium text-[var(--dec-text)] transition hover:bg-[var(--dec-light-soft)]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
