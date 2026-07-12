"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import {
  encounterCreateSchema,
  patientCreateSchema,
  patientUpdateSchema,
  prescriptionCreateSchema,
  summaryCreateSchema,
} from "@/lib/validation";
import { createEncounter } from "@/services/encounters";
import { createPatient, updatePatient } from "@/services/patients";
import { createPrescription } from "@/services/prescriptions";
import { createSummary, updateSummary } from "@/services/summaries";

const VIA = "web";
export type FormState = { error?: string };

async function auth() {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  return webAuth(doctor);
}

function firstIssue(err: unknown): string {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return `${i.path.join(".")}: ${i.message}`;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

// Split a comma/newline-separated field into a clean string array.
function list(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

function patientPayload(fd: FormData) {
  return {
    name: str(fd.get("name")),
    dateOfBirth: str(fd.get("dateOfBirth")),
    sex: str(fd.get("sex")),
    phone: str(fd.get("phone")),
    abhaId: str(fd.get("abhaId")),
    bloodGroup: str(fd.get("bloodGroup")),
    allergies: list(fd.get("allergies")),
    chronicConditions: list(fd.get("chronicConditions")),
    notes: str(fd.get("notes")),
  };
}

export async function createPatientAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await auth();
  let id: string;
  try {
    const data = patientCreateSchema.parse(patientPayload(fd));
    const patient = await createPatient(a, data, VIA);
    id = patient.id;
  } catch (err) {
    return { error: firstIssue(err) };
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/patients/${id}`);
}

export async function updatePatientAction(
  patientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await auth();
  try {
    const data = patientUpdateSchema.parse(patientPayload(fd));
    await updatePatient(a, patientId, data, VIA);
  } catch (err) {
    return { error: firstIssue(err) };
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
  redirect(`/dashboard/patients/${patientId}`);
}

export async function addEncounterAction(
  patientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await auth();
  try {
    const vitals: Record<string, string> = {};
    for (const k of ["bp", "pulse", "temp", "spo2", "weight"]) {
      const v = str(fd.get(`vitals_${k}`));
      if (v) vitals[k] = v;
    }
    const data = encounterCreateSchema.parse({
      date: str(fd.get("date")),
      complaint: str(fd.get("complaint")),
      examination: str(fd.get("examination")),
      vitals: Object.keys(vitals).length ? vitals : undefined,
      diagnosis: str(fd.get("diagnosis")),
      plan: str(fd.get("plan")),
      notes: str(fd.get("notes")),
    });
    await createEncounter(a, patientId, data, VIA);
  } catch (err) {
    return { error: firstIssue(err) };
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
  redirect(`/dashboard/patients/${patientId}`);
}

// Medications arrive as a JSON string from the dynamic form component.
function parseMeds(fd: FormData): unknown {
  try {
    return JSON.parse(String(fd.get("medications") ?? "[]"));
  } catch {
    return [];
  }
}

export async function addPrescriptionAction(
  patientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await auth();
  try {
    const data = prescriptionCreateSchema.parse({
      date: str(fd.get("date")),
      medications: parseMeds(fd),
      advice: str(fd.get("advice")),
      followUpDate: str(fd.get("followUpDate")),
    });
    await createPrescription(a, patientId, data, VIA);
  } catch (err) {
    return { error: firstIssue(err) };
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
  redirect(`/dashboard/patients/${patientId}`);
}

export async function createSummaryAction(
  patientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await auth();
  try {
    const data = summaryCreateSchema.parse({
      admissionDate: str(fd.get("admissionDate")),
      dischargeDate: str(fd.get("dischargeDate")),
      diagnosis: str(fd.get("diagnosis")),
      presentingComplaint: str(fd.get("presentingComplaint")),
      hospitalCourse: str(fd.get("hospitalCourse")),
      investigations: str(fd.get("investigations")),
      treatmentGiven: str(fd.get("treatmentGiven")),
      conditionAtDischarge: str(fd.get("conditionAtDischarge")),
      medicationsAtDischarge: parseMeds(fd),
      followUpInstructions: str(fd.get("followUpInstructions")),
    });
    await createSummary(a, patientId, data, VIA);
  } catch (err) {
    return { error: firstIssue(err) };
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
  redirect(`/dashboard/patients/${patientId}`);
}

export async function finalizeSummaryAction(summaryId: string, patientId: string) {
  const a = await auth();
  await updateSummary(a, summaryId, { status: "FINAL" }, VIA);
  revalidatePath(`/dashboard/patients/${patientId}`);
}
