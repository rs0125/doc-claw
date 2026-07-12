import { z } from "zod";

// Zero-width characters, bidi overrides and control chars enable name spoofing
// ("Ramesh" vs "Ra​mesh" as two visually identical patients) — strip them from
// identity-critical fields before storage.
const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

const sanitizedName = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(INVISIBLE_CHARS, "").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(max));

export const medicationSchema = z.object({
  name: sanitizedName(200),
  dose: z.string().min(1), // "500 mg" — free text on purpose; agent echoes back before saving
  frequency: z.string().min(1), // "1-0-1", "twice daily"
  duration: z.string().optional(), // "5 days"
  notes: z.string().optional(),
});

export type Medication = z.infer<typeof medicationSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  // Round-trip check: V8 silently rolls impossible dates over (Feb 31 → Mar 3),
  // so NaN alone doesn't catch them.
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Not a real calendar date")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const patientBase = z.object({
  name: sanitizedName(200),
  dateOfBirth: isoDate.optional(),
  age: z.coerce.number().int().min(0).max(120).optional(), // convenience: folds into an approximate DOB
  sex: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
  phone: z.string().max(20).optional(),
  abhaId: z.string().max(20).optional(),
  bloodGroup: z.string().max(10).optional(),
  allergies: z.array(z.string().min(1)).optional(),
  chronicConditions: z.array(z.string().min(1)).optional(),
  currentMedications: z.array(medicationSchema).optional(),
  notes: z.string().max(10_000).optional(),
});

// Folds an `age` into `dateOfBirth`: a known DOB always wins; otherwise an age
// becomes Jan 1 of the birth year, flagged approximate so the UI stays honest.
function foldAge<T extends { age?: number; dateOfBirth?: Date }>(
  v: T,
): Omit<T, "age"> & { dobApproximate?: boolean } {
  const { age, ...rest } = v;
  if (rest.dateOfBirth) return { ...rest, dobApproximate: false };
  if (age != null) {
    const year = new Date().getUTCFullYear() - age;
    return { ...rest, dateOfBirth: new Date(Date.UTC(year, 0, 1)), dobApproximate: true };
  }
  return rest;
}

export const patientCreateSchema = patientBase.transform(foldAge);
export const patientUpdateSchema = patientBase.partial().transform(foldAge);

export const summaryCreateSchema = z.object({
  admissionDate: isoDate,
  dischargeDate: isoDate,
  diagnosis: z.string().min(1),
  presentingComplaint: z.string().optional(),
  hospitalCourse: z.string().min(1),
  investigations: z.string().optional(),
  treatmentGiven: z.string().optional(),
  conditionAtDischarge: z.string().optional(),
  medicationsAtDischarge: z.array(medicationSchema).optional(),
  followUpInstructions: z.string().optional(),
});

export const summaryUpdateSchema = summaryCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

export const encounterCreateSchema = z.object({
  date: isoDate,
  complaint: z.string().min(1),
  examination: z.string().optional(),
  vitals: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  diagnosis: z.string().optional(),
  plan: z.string().optional(),
  notes: z.string().optional(),
});

export const encounterUpdateSchema = encounterCreateSchema.partial();

export const prescriptionCreateSchema = z.object({
  date: isoDate,
  encounterId: z.string().optional(),
  medications: z.array(medicationSchema).min(1),
  advice: z.string().optional(),
  followUpDate: isoDate.optional(),
});

export const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
