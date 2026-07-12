import type { z } from "zod";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { renderPrescriptionPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";
import { putObject, signedGetUrl } from "@/lib/r2";
import type { prescriptionCreateSchema } from "@/lib/validation";
import { assertOwnedPatient } from "@/services/patients";

type PrescriptionCreate = z.infer<typeof prescriptionCreateSchema>;

export async function listPrescriptions(auth: AuthContext, patientId: string) {
  await assertOwnedPatient(auth, patientId);
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId, doctorId: auth.doctor.id, archivedAt: null },
    orderBy: { date: "desc" },
  });
  auditRead(auth, {
    action: "prescription.list",
    resourceType: "Prescription",
    details: { patientId, results: prescriptions.length },
  });
  return prescriptions;
}

export async function getPrescription(auth: AuthContext, prescriptionId: string) {
  const prescription = await prisma.prescription.findFirst({
    where: { id: prescriptionId, doctorId: auth.doctor.id },
  });
  if (!prescription) throw new ApiError(404, "Prescription not found");
  auditRead(auth, {
    action: "prescription.read",
    resourceType: "Prescription",
    resourceId: prescription.id,
  });
  return prescription;
}

export async function createPrescription(
  auth: AuthContext,
  patientId: string,
  data: PrescriptionCreate,
  via?: string,
) {
  await assertOwnedPatient(auth, patientId);

  if (data.encounterId) {
    const encounter = await prisma.encounter.findFirst({
      where: { id: data.encounterId, doctorId: auth.doctor.id, patientId },
      select: { id: true },
    });
    if (!encounter) throw new ApiError(404, "Encounter not found for this patient");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.prescription.create({
      data: { ...data, patientId, doctorId: auth.doctor.id },
    });
    await audit(
      auth,
      {
        action: "prescription.create",
        resourceType: "Prescription",
        resourceId: created.id,
        details: { patientId, ...(via ? { via } : {}) },
      },
      tx,
    );
    return created;
  });
}

export async function updatePrescription(
  auth: AuthContext,
  prescriptionId: string,
  data: PrescriptionCreate,
  via?: string,
) {
  const existing = await prisma.prescription.findFirst({
    where: { id: prescriptionId, doctorId: auth.doctor.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Prescription not found");

  return prisma.$transaction(async (tx) => {
    // Re-render on next download: clear the stale cached PDF stamp.
    const updated = await tx.prescription.update({
      where: { id: prescriptionId },
      data: { ...data, documentGeneratedAt: null },
    });
    await audit(
      auth,
      {
        action: "prescription.update",
        resourceType: "Prescription",
        resourceId: prescriptionId,
        details: { ...(via ? { via } : {}) },
      },
      tx,
    );
    return updated;
  });
}

export async function archivePrescription(auth: AuthContext, prescriptionId: string, via?: string) {
  const existing = await prisma.prescription.findFirst({
    where: { id: prescriptionId, doctorId: auth.doctor.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Prescription not found");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prescription.update({
      where: { id: prescriptionId },
      data: { archivedAt: new Date() },
    });
    await audit(
      auth,
      { action: "prescription.archive", resourceType: "Prescription", resourceId: prescriptionId, details: via ? { via } : undefined },
      tx,
    );
    return updated;
  });
}

/** Renders the PDF to R2 if missing/stale, returns a short-lived signed URL. */
export async function getPrescriptionDocumentUrl(auth: AuthContext, prescriptionId: string) {
  const prescription = await prisma.prescription.findFirst({
    where: { id: prescriptionId, doctorId: auth.doctor.id },
    include: { patient: true },
  });
  if (!prescription) throw new ApiError(404, "Prescription not found");

  const stale =
    !prescription.documentKey ||
    !prescription.documentGeneratedAt ||
    prescription.documentGeneratedAt < prescription.updatedAt;

  let documentKey = prescription.documentKey;
  if (stale) {
    const pdf = await renderPrescriptionPdf(prescription, prescription.patient, auth.doctor);
    documentKey = `doctors/${auth.doctor.id}/prescriptions/${prescription.id}.pdf`;
    await putObject(documentKey, pdf, "application/pdf");
    await prisma.prescription.update({
      where: { id: prescription.id },
      data: { documentKey, documentGeneratedAt: new Date() },
    });
  }

  const expiresInSeconds = 900;
  const url = await signedGetUrl(documentKey!, expiresInSeconds);

  await audit(auth, {
    action: "prescription.document.download",
    resourceType: "Prescription",
    resourceId: prescription.id,
    details: { regenerated: stale },
  });

  return { url, expiresInSeconds };
}
