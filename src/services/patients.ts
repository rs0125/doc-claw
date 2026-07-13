import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Patient } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/r2";
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

export type PatientFilters = { sex?: string; bloodGroup?: string };

export async function searchPatients(
  auth: AuthContext,
  {
    q,
    sex,
    bloodGroup,
    limit,
    offset,
  }: { q?: string; limit: number; offset: number } & PatientFilters,
) {
  // No query: filtered, most-recently-updated, real paginated total.
  if (!q) {
    const where = {
      doctorId: auth.doctor.id,
      archivedAt: null,
      ...(sex ? { sex: sex as never } : {}),
      ...(bloodGroup ? { bloodGroup } : {}),
    };
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, skip: offset }),
      prisma.patient.count({ where }),
    ]);
    auditRead(auth, {
      action: "patient.search",
      resourceType: "Patient",
      details: { q: null, sex, bloodGroup, results: patients.length },
    });
    return { patients, total };
  }

  // Fuzzy: trigram + ILIKE on name, phone substring, with filters — composed as
  // parameterized SQL fragments so both the page and the count share one WHERE.
  const like = `%${q}%`;
  const conds: Prisma.Sql[] = [
    Prisma.sql`"doctorId" = ${auth.doctor.id}`,
    Prisma.sql`"archivedAt" IS NULL`,
    Prisma.sql`(similarity("name", ${q}) > ${FUZZY_THRESHOLD} OR "name" ILIKE ${like} OR ("phone" IS NOT NULL AND "phone" LIKE ${like}))`,
  ];
  if (sex) conds.push(Prisma.sql`"sex"::text = ${sex}`);
  if (bloodGroup) conds.push(Prisma.sql`"bloodGroup" = ${bloodGroup}`);
  const where = Prisma.join(conds, " AND ");

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<(Patient & { match_score: number })[]>(Prisma.sql`
      SELECT *,
             GREATEST(
               similarity("name", ${q}),
               CASE WHEN "name" ILIKE ${like} THEN 0.85 ELSE 0 END,
               CASE WHEN "phone" IS NOT NULL AND "phone" LIKE ${like} THEN 0.85 ELSE 0 END
             ) AS match_score
      FROM "Patient"
      WHERE ${where}
      ORDER BY match_score DESC, "updatedAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS count FROM "Patient" WHERE ${where}
    `),
  ]);

  const patients = rows.map(({ match_score: _score, ...p }) => p);
  const total = Number(countRows[0]?.count ?? patients.length);

  auditRead(auth, {
    action: "patient.search",
    resourceType: "Patient",
    details: { q, sex, bloodGroup, results: patients.length, fuzzy: true },
  });

  return { patients, total };
}

export async function getPatient(auth: AuthContext, patientId: string) {
  const patient = await assertOwnedPatient(auth, patientId);
  auditRead(auth, { action: "patient.read", resourceType: "Patient", resourceId: patient.id });
  return patient;
}

/**
 * Finds a likely-duplicate active patient before creating: same phone, or an
 * exact (case-insensitive) name match. Used to warn the doctor, not to block.
 */
export async function findDuplicatePatient(
  auth: AuthContext,
  { name, phone }: { name?: string; phone?: string },
) {
  return prisma.patient.findFirst({
    where: {
      doctorId: auth.doctor.id,
      archivedAt: null,
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(name ? [{ name: { equals: name, mode: "insensitive" as const } }] : []),
      ],
    },
  });
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

/**
 * Permanent erasure (DPDP): removes the patient and everything cascading from
 * them, including R2 attachment objects. Irreversible.
 */
export async function deletePatient(auth: AuthContext, patientId: string, via?: string) {
  await assertOwnedPatient(auth, patientId);
  // Purge R2 objects first (DB cascade can't reach object storage).
  const attachments = await prisma.attachment.findMany({
    where: { patientId, doctorId: auth.doctor.id },
    select: { r2Key: true },
  });
  await Promise.all(attachments.map((a) => deleteObject(a.r2Key).catch(() => {})));

  await prisma.$transaction(async (tx) => {
    // Audit BEFORE deleting (the row's FK is cascade-safe; audit keeps doctorId).
    await audit(
      auth,
      { action: "patient.delete", resourceType: "Patient", resourceId: patientId, details: { erasure: true, ...(via ? { via } : {}) } },
      tx,
    );
    await tx.patient.delete({ where: { id: patientId } });
  });
}
