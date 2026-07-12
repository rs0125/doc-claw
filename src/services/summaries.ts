import type { z } from "zod";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { renderDischargeSummaryPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";
import { putObject, signedGetUrl } from "@/lib/r2";
import type { summaryCreateSchema, summaryUpdateSchema } from "@/lib/validation";
import { assertOwnedPatient } from "@/services/patients";

type SummaryCreate = z.infer<typeof summaryCreateSchema>;
type SummaryUpdate = z.infer<typeof summaryUpdateSchema>;

async function assertOwnedSummary(auth: AuthContext, summaryId: string) {
  const summary = await prisma.dischargeSummary.findFirst({
    where: { id: summaryId, doctorId: auth.doctor.id },
  });
  if (!summary) throw new ApiError(404, "Discharge summary not found");
  return summary;
}

export async function listSummaries(auth: AuthContext, patientId: string) {
  await assertOwnedPatient(auth, patientId);
  const summaries = await prisma.dischargeSummary.findMany({
    where: { patientId, doctorId: auth.doctor.id },
    orderBy: { dischargeDate: "desc" },
  });
  auditRead(auth, {
    action: "summary.list",
    resourceType: "DischargeSummary",
    details: { patientId, results: summaries.length },
  });
  return summaries;
}

export async function getSummary(auth: AuthContext, summaryId: string) {
  const summary = await assertOwnedSummary(auth, summaryId);
  auditRead(auth, {
    action: "summary.read",
    resourceType: "DischargeSummary",
    resourceId: summary.id,
  });
  return summary;
}

export async function createSummary(
  auth: AuthContext,
  patientId: string,
  data: SummaryCreate,
  via?: string,
) {
  await assertOwnedPatient(auth, patientId);
  if (data.dischargeDate < data.admissionDate) {
    throw new ApiError(400, "dischargeDate cannot be before admissionDate");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.dischargeSummary.create({
      data: { ...data, patientId, doctorId: auth.doctor.id },
    });
    await audit(
      auth,
      {
        action: "summary.create",
        resourceType: "DischargeSummary",
        resourceId: created.id,
        details: { patientId, ...(via ? { via } : {}) },
      },
      tx,
    );
    return created;
  });
}

export async function updateSummary(
  auth: AuthContext,
  summaryId: string,
  data: SummaryUpdate,
  via?: string,
) {
  const existing = await assertOwnedSummary(auth, summaryId);
  if (existing.status === "FINAL") {
    throw new ApiError(409, "Summary is finalized and can no longer be edited");
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, "Empty update");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dischargeSummary.update({ where: { id: summaryId }, data });
    await audit(
      auth,
      {
        action: data.status === "FINAL" ? "summary.finalize" : "summary.update",
        resourceType: "DischargeSummary",
        resourceId: summaryId,
        details: { changedFields: Object.keys(data), ...(via ? { via } : {}) },
      },
      tx,
    );
    return updated;
  });
}

/** Renders the PDF to R2 if missing/stale, returns a short-lived signed URL. */
export async function getSummaryDocumentUrl(auth: AuthContext, summaryId: string) {
  const summary = await prisma.dischargeSummary.findFirst({
    where: { id: summaryId, doctorId: auth.doctor.id },
    include: { patient: true },
  });
  if (!summary) throw new ApiError(404, "Discharge summary not found");

  const stale =
    !summary.documentKey ||
    !summary.documentGeneratedAt ||
    summary.documentGeneratedAt < summary.updatedAt;

  let documentKey = summary.documentKey;
  if (stale) {
    const pdf = await renderDischargeSummaryPdf(summary, summary.patient, auth.doctor);
    documentKey = `doctors/${auth.doctor.id}/discharge-summaries/${summary.id}.pdf`;
    await putObject(documentKey, pdf, "application/pdf");
    await prisma.dischargeSummary.update({
      where: { id: summary.id },
      data: { documentKey, documentGeneratedAt: new Date() },
    });
  }

  const expiresInSeconds = 900;
  const url = await signedGetUrl(documentKey!, expiresInSeconds);

  await audit(auth, {
    action: "summary.document.download",
    resourceType: "DischargeSummary",
    resourceId: summary.id,
    details: { regenerated: stale },
  });

  return { url, expiresInSeconds };
}
