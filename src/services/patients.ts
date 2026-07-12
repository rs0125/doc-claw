import type { z } from "zod";
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
  if (!patient) throw new ApiError(404, "Patient not found");
  return patient;
}

export async function searchPatients(
  auth: AuthContext,
  { q, limit, offset }: { q?: string; limit: number; offset: number },
) {
  const where = {
    doctorId: auth.doctor.id,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, skip: offset }),
    prisma.patient.count({ where }),
  ]);

  auditRead(auth, {
    action: "patient.search",
    resourceType: "Patient",
    details: { q: q ?? null, results: patients.length },
  });

  return { patients, total };
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
