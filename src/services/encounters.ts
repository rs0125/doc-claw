import type { z } from "zod";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { encounterCreateSchema, encounterUpdateSchema } from "@/lib/validation";
import { assertOwnedPatient } from "@/services/patients";

type EncounterCreate = z.infer<typeof encounterCreateSchema>;
type EncounterUpdate = z.infer<typeof encounterUpdateSchema>;

export async function listEncounters(auth: AuthContext, patientId: string) {
  await assertOwnedPatient(auth, patientId);
  const encounters = await prisma.encounter.findMany({
    where: { patientId, doctorId: auth.doctor.id, archivedAt: null },
    orderBy: { date: "desc" },
  });
  auditRead(auth, {
    action: "encounter.list",
    resourceType: "Encounter",
    details: { patientId, results: encounters.length },
  });
  return encounters;
}

export async function getEncounter(auth: AuthContext, encounterId: string) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, doctorId: auth.doctor.id },
  });
  if (!encounter) throw new ApiError(404, "Encounter not found");
  auditRead(auth, {
    action: "encounter.read",
    resourceType: "Encounter",
    resourceId: encounter.id,
  });
  return encounter;
}

export async function createEncounter(
  auth: AuthContext,
  patientId: string,
  data: EncounterCreate,
  via?: string,
) {
  await assertOwnedPatient(auth, patientId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.encounter.create({
      data: { ...data, patientId, doctorId: auth.doctor.id },
    });
    await audit(
      auth,
      {
        action: "encounter.create",
        resourceType: "Encounter",
        resourceId: created.id,
        details: { patientId, ...(via ? { via } : {}) },
      },
      tx,
    );
    return created;
  });
}

export async function updateEncounter(
  auth: AuthContext,
  encounterId: string,
  data: EncounterUpdate,
  via?: string,
) {
  const existing = await prisma.encounter.findFirst({
    where: { id: encounterId, doctorId: auth.doctor.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Encounter not found");
  if (Object.keys(data).length === 0) throw new ApiError(400, "Empty update");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.encounter.update({ where: { id: encounterId }, data });
    await audit(
      auth,
      {
        action: "encounter.update",
        resourceType: "Encounter",
        resourceId: encounterId,
        details: { changedFields: Object.keys(data), ...(via ? { via } : {}) },
      },
      tx,
    );
    return updated;
  });
}

export async function archiveEncounter(auth: AuthContext, encounterId: string, via?: string) {
  const existing = await prisma.encounter.findFirst({
    where: { id: encounterId, doctorId: auth.doctor.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Encounter not found");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.encounter.update({
      where: { id: encounterId },
      data: { archivedAt: new Date() },
    });
    await audit(
      auth,
      { action: "encounter.archive", resourceType: "Encounter", resourceId: encounterId, details: via ? { via } : undefined },
      tx,
    );
    return updated;
  });
}
