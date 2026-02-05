/** Role stored in users.role */
export type Role = "reception" | "doctor";

/** Status stored in appointments.status */
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

/** Row from Supabase users table (snake_case) */
export type DbUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  password: string | null;
  role: Role;
  email_verified: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from Supabase appointments table (snake_case) */
export type DbAppointment = {
  id: string;
  patient_name: string;
  appointment_date: string;
  duration_minutes: number;
  exam_type: string;
  status: AppointmentStatus;
  onedrive_link: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_doctor_id: string | null;
};

/** App-facing user (camelCase) */
export type User = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  password: string | null;
  role: Role;
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
};

/** App-facing appointment with optional assigned doctor (camelCase) */
export type Appointment = {
  id: string;
  patientName: string;
  appointmentDate: string;
  durationMinutes: number;
  examType: string;
  status: AppointmentStatus;
  oneDriveLink: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  assignedDoctorId: string | null;
  assignedDoctor: { id: string; name: string | null; email: string | null } | null;
};

export function dbUserToUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    password: row.password,
    role: row.role,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function dbAppointmentToAppointment(
  row: DbAppointment,
  doctor?: { id: string; name: string | null; email: string | null } | null
): Appointment {
  return {
    id: row.id,
    patientName: row.patient_name,
    appointmentDate: row.appointment_date,
    durationMinutes: row.duration_minutes,
    examType: row.exam_type,
    status: row.status,
    oneDriveLink: row.onedrive_link,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedDoctorId: row.assigned_doctor_id,
    assignedDoctor: doctor ?? null,
  };
}

/** Payload for inserting an appointment (snake_case for DB) */
export function appointmentInsertToDb(data: {
  patientName: string;
  appointmentDate: Date;
  durationMinutes: number;
  examType: string;
  oneDriveLink?: string | null;
  internalNotes?: string | null;
  assignedDoctorId?: string | null;
}) {
  return {
    patient_name: data.patientName,
    appointment_date: data.appointmentDate.toISOString(),
    duration_minutes: data.durationMinutes,
    exam_type: data.examType,
    onedrive_link: data.oneDriveLink ?? null,
    internal_notes: data.internalNotes ?? null,
    assigned_doctor_id: data.assignedDoctorId ?? null,
  };
}

/** Payload for updating an appointment (snake_case for DB, only defined fields) */
export function appointmentUpdateToDb(data: {
  patientName?: string;
  appointmentDate?: Date;
  durationMinutes?: number;
  examType?: string;
  status?: AppointmentStatus;
  oneDriveLink?: string | null;
  internalNotes?: string | null;
  assignedDoctorId?: string | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.patientName != null) out.patient_name = data.patientName;
  if (data.appointmentDate != null) out.appointment_date = data.appointmentDate.toISOString();
  if (data.durationMinutes != null) out.duration_minutes = data.durationMinutes;
  if (data.examType != null) out.exam_type = data.examType;
  if (data.status != null) out.status = data.status;
  if (data.oneDriveLink !== undefined) out.onedrive_link = data.oneDriveLink || null;
  if (data.internalNotes !== undefined) out.internal_notes = data.internalNotes;
  if (data.assignedDoctorId !== undefined) out.assigned_doctor_id = data.assignedDoctorId;
  return out;
}
