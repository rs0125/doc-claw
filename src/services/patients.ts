import type { z } from "zod";
import type { Patient } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { patientCreateSchema, patientUpdateSchema } from "@/lib/validation";

type PatientCreate = z.infer<typeof patientCreateSchema>;
type PatientUpdate = z.infer<typeof patientUpdateSchema>;

/** Throws 404 unless the patient exists and belongs to this doctor. */
export async function assertOwnedPatient(auth: AuthContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: auth.doctor.id },
  });
  if (!patient) {
    throw new ApiError(
      404,
      "No patient with that id. Do not guess ids — call search_patients to get a valid one.",
    );
  }
  return patient;
}

// Trigram similarity floor. Names below this aren't considered matches; the
// ILIKE substring branch still catches exact partials the score would miss.
const FUZZY_THRESHOLD = 0.2;

export async function searchPatients(
  auth: AuthContext,
  { q, limit, offset }: { q?: string; limit: number; offset: number },
) {
  // No query: most-recently-updated patients.
  if (!q) {
    const where = { doctorId: auth.doctor.id };
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, skip: offset }),
      prisma.patient.count({ where }),
    ]);
    auditRead(auth, {
      action: "patient.search",
      resourceType: "Patient",
      details: { q: null, results: patients.length },
    });
    return { patients, total };
  }

  // Fuzzy: trigram similarity on name, ILIKE fallback for substrings, plus
  // phone substring. Ranked best-match first. Parameterized to prevent injection.
  const like = `%${q}%`;
  const rows = await prisma.$queryRaw<(Patient & { match_score: number })[]>`
    SELECT *,
           GREATEST(
             similarity("name", ${q}),
             CASE WHEN "name" ILIKE ${like} THEN 0.85 ELSE 0 END,
             CASE WHEN "phone" IS NOT NULL AND "phone" LIKE ${like} THEN 0.85 ELSE 0 END
           ) AS match_score
    FROM "Patient"
    WHERE "doctorId" = ${auth.doctor.id}
      AND (
        similarity("name", ${q}) > ${FUZZY_THRESHOLD}
        OR "name" ILIKE ${like}
        OR ("phone" IS NOT NULL AND "phone" LIKE ${like})
      )
    ORDER BY match_score DESC, "updatedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const patients = rows.map(({ match_score, ...p }) => p);

  auditRead(auth, {
    action: "patient.search",
    resourceType: "Patient",
    details: { q, results: patients.length, fuzzy: true },
  });

  return { patients, total: patients.length };
}

export async function getPatient(auth: AuthContext, patientId: string) {
  const patient = await assertOwnedPatient(auth, patientId);
  auditRead(auth, { action: "patient.read", resourceType: "Patient", resourceId: patient.id });
  return patient;
}

export async function createPatient(auth: AuthContext, data: PatientCreate, via?: string) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.patient.create({ data: { ...data, doctorId: auth.doctor.id } });
    await audit(
      auth,
      {
        action: "patient.create",
        resourceType: "Patient",
        resourceId: created.id,
        details: via ? { via } : undefined,
      },
      tx,
    );
    return created;
  });
}

export async function updatePatient(
  auth: AuthContext,
  patientId: string,
  data: PatientUpdate,
  via?: string,
) {
  await assertOwnedPatient(auth, patientId);
  if (Object.keys(data).length === 0) throw new ApiError(400, "Empty update");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.patient.update({ where: { id: patientId }, data });
    await audit(
      auth,
      {
        action: "patient.update",
        resourceType: "Patient",
        resourceId: patientId,
        details: { changedFields: Object.keys(data), ...(via ? { via } : {}) },
      },
      tx,
    );
    return updated;
  });
}
