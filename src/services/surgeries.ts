import type { z } from "zod";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { renderSurgeryPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";
import { putObject, signedGetUrl } from "@/lib/r2";
import type { surgeryCreateSchema, surgeryUpdateSchema } from "@/lib/validation";
import { assertOwnedPatient } from "@/services/patients";

type SurgeryCreate = z.infer<typeof surgeryCreateSchema>;
type SurgeryUpdate = z.infer<typeof surgeryUpdateSchema>;

async function assertOwnedSurgery(auth: AuthContext, surgeryId: string) {
  const surgery = await prisma.surgery.findFirst({
    where: { id: surgeryId, doctorId: auth.doctor.id },
  });
  if (!surgery) throw new ApiError(404, "Surgery not found");
  return surgery;
}

export async function listSurgeries(auth: AuthContext, patientId: string) {
  await assertOwnedPatient(auth, patientId);
  const surgeries = await prisma.surgery.findMany({
    where: { patientId, doctorId: auth.doctor.id, archivedAt: null },
    orderBy: { dischargeDate: "desc" },
  });
  auditRead(auth, {
    action: "surgery.list",
    resourceType: "Surgery",
    details: { patientId, results: surgeries.length },
  });
  return surgeries;
}

export async function getSurgery(auth: AuthContext, surgeryId: string) {
  const surgery = await assertOwnedSurgery(auth, surgeryId);
  auditRead(auth, {
    action: "surgery.read",
    resourceType: "Surgery",
    resourceId: surgery.id,
  });
  return surgery;
}

export async function createSurgery(
  auth: AuthContext,
  patientId: string,
  data: SurgeryCreate,
  via?: string,
) {
  await assertOwnedPatient(auth, patientId);
  if (data.dischargeDate < data.admissionDate) {
    throw new ApiError(400, "dischargeDate cannot be before admissionDate");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.surgery.create({
      data: { ...data, patientId, doctorId: auth.doctor.id },
    });
    await audit(
      auth,
      {
        action: "surgery.create",
        resourceType: "Surgery",
        resourceId: created.id,
        details: { patientId, ...(via ? { via } : {}) },
      },
      tx,
    );
    return created;
  });
}

export async function updateSurgery(
  auth: AuthContext,
  surgeryId: string,
  data: SurgeryUpdate,
  via?: string,
) {
  const existing = await assertOwnedSurgery(auth, surgeryId);
  if (existing.status === "FINAL") {
    throw new ApiError(409, "Surgery is finalized and can no longer be edited");
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, "Empty update");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.surgery.update({ where: { id: surgeryId }, data });
    await audit(
      auth,
      {
        action: data.status === "FINAL" ? "surgery.finalize" : "surgery.update",
        resourceType: "Surgery",
        resourceId: surgeryId,
        details: { changedFields: Object.keys(data), ...(via ? { via } : {}) },
      },
      tx,
    );
    return updated;
  });
}

export async function archiveSurgery(auth: AuthContext, surgeryId: string, via?: string) {
  await assertOwnedSurgery(auth, surgeryId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.surgery.update({
      where: { id: surgeryId },
      data: { archivedAt: new Date() },
    });
    await audit(
      auth,
      { action: "surgery.archive", resourceType: "Surgery", resourceId: surgeryId, details: via ? { via } : undefined },
      tx,
    );
    return updated;
  });
}

/** Renders the PDF to R2 if missing/stale, returns a short-lived signed URL. */
export async function getSurgeryDocumentUrl(auth: AuthContext, surgeryId: string) {
  const surgery = await prisma.surgery.findFirst({
    where: { id: surgeryId, doctorId: auth.doctor.id },
    include: { patient: true },
  });
  if (!surgery) throw new ApiError(404, "Surgery not found");

  const stale =
    !surgery.documentKey ||
    !surgery.documentGeneratedAt ||
    surgery.documentGeneratedAt < surgery.updatedAt;

  let documentKey = surgery.documentKey;
  if (stale) {
    const pdf = await renderSurgeryPdf(surgery, surgery.patient, auth.doctor);
    documentKey = `doctors/${auth.doctor.id}/surgeries/${surgery.id}.pdf`;
    await putObject(documentKey, pdf, "application/pdf");
    await prisma.surgery.update({
      where: { id: surgery.id },
      data: { documentKey, documentGeneratedAt: new Date() },
    });
  }

  const expiresInSeconds = 900;
  const url = await signedGetUrl(documentKey!, expiresInSeconds);

  await audit(auth, {
    action: "surgery.document.download",
    resourceType: "Surgery",
    resourceId: surgery.id,
    details: { regenerated: stale },
  });

  return { url, expiresInSeconds };
}
