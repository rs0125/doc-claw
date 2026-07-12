import { z } from "zod";

export const medicationSchema = z.object({
  name: z.string().min(1),
  dose: z.string().min(1), // "500 mg" — free text on purpose; agent echoes back before saving
  frequency: z.string().min(1), // "1-0-1", "twice daily"
  duration: z.string().optional(), // "5 days"
  notes: z.string().optional(),
});

export type Medication = z.infer<typeof medicationSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

export const patientCreateSchema = z.object({
  name: z.string().min(1).max(200),
  dateOfBirth: isoDate.optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
  phone: z.string().max(20).optional(),
  abhaId: z.string().max(20).optional(),
  bloodGroup: z.string().max(10).optional(),
  allergies: z.array(z.string().min(1)).optional(),
  chronicConditions: z.array(z.string().min(1)).optional(),
  currentMedications: z.array(medicationSchema).optional(),
  notes: z.string().max(10_000).optional(),
});

export const patientUpdateSchema = patientCreateSchema.partial();

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
