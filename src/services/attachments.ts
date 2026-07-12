import { randomBytes } from "crypto";
import type { AttachmentKind } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteObject, putObject, signedGetUrl, signedPutUrl } from "@/lib/r2";
import { assertOwnedPatient } from "@/services/patients";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_UPLOAD_URL_TTL = 300;

function extFor(contentType: string): string {
  return (
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[
      contentType
    ] ?? "bin"
  );
}

/**
 * Registers an attachment and returns a presigned PUT URL the client uploads to
 * directly. The row exists immediately (uploadedAt=null) and is only surfaced
 * once completeAttachment marks the upload done.
 */
export async function createAttachment(
  auth: AuthContext,
  input: {
    patientId: string;
    kind: AttachmentKind;
    contentType: string;
    fileName?: string;
    prescriptionId?: string;
    dischargeSummaryId?: string;
    source?: string;
  },
) {
  await assertOwnedPatient(auth, input.patientId);
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw new ApiError(400, "Unsupported file type (use JPEG, PNG, WebP or PDF)");
  }

  const r2Key = `doctors/${auth.doctor.id}/attachments/${randomBytes(12).toString("hex")}.${extFor(input.contentType)}`;

  const attachment = await prisma.$transaction(async (tx) => {
    const created = await tx.attachment.create({
      data: {
        doctorId: auth.doctor.id,
        patientId: input.patientId,
        kind: input.kind,
        contentType: input.contentType,
        fileName: input.fileName,
        prescriptionId: input.prescriptionId,
        dischargeSummaryId: input.dischargeSummaryId,
        source: input.source ?? "web",
        r2Key,
      },
    });
    await audit(
      auth,
      {
        action: "attachment.create",
        resourceType: "Attachment",
        resourceId: created.id,
        details: { patientId: input.patientId, kind: input.kind },
      },
      tx,
    );
    return created;
  });

  const uploadUrl = await signedPutUrl(r2Key, input.contentType, MAX_UPLOAD_URL_TTL);
  return { attachment, uploadUrl };
}

export async function completeAttachment(auth: AuthContext, attachmentId: string) {
  const a = await prisma.attachment.findFirst({
    where: { id: attachmentId, doctorId: auth.doctor.id },
  });
  if (!a) throw new ApiError(404, "Attachment not found");
  return prisma.attachment.update({
    where: { id: attachmentId },
    data: { uploadedAt: new Date() },
  });
}

/** Server-side ingest (Telegram): we hold the bytes, so upload + mark complete. */
export async function ingestAttachment(
  auth: AuthContext,
  input: {
    patientId: string;
    kind: AttachmentKind;
    contentType: string;
    fileName?: string;
    bytes: Uint8Array;
    source?: string;
  },
) {
  const { attachment } = await createAttachment(auth, { ...input, source: input.source ?? "telegram" });
  await putObject(attachment.r2Key, input.bytes, input.contentType);
  return completeAttachment(auth, attachment.id);
}

export async function listAttachments(
  auth: AuthContext,
  patientId: string,
  kind?: AttachmentKind,
) {
  await assertOwnedPatient(auth, patientId);
  const attachments = await prisma.attachment.findMany({
    where: { patientId, doctorId: auth.doctor.id, uploadedAt: { not: null }, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
  });
  auditRead(auth, {
    action: "attachment.list",
    resourceType: "Attachment",
    details: { patientId, results: attachments.length },
  });
  return attachments;
}

/** Presigned GET URL for one attachment (ownership-checked). */
export async function getAttachmentUrl(auth: AuthContext, attachmentId: string) {
  const a = await prisma.attachment.findFirst({
    where: { id: attachmentId, doctorId: auth.doctor.id },
  });
  if (!a) throw new ApiError(404, "Attachment not found");
  auditRead(auth, {
    action: "attachment.download",
    resourceType: "Attachment",
    resourceId: a.id,
  });
  const url = await signedGetUrl(a.r2Key, 900);
  return { url, attachment: a };
}

export async function deleteAttachment(auth: AuthContext, attachmentId: string) {
  const a = await prisma.attachment.findFirst({
    where: { id: attachmentId, doctorId: auth.doctor.id },
  });
  if (!a) throw new ApiError(404, "Attachment not found");
  await deleteObject(a.r2Key).catch(() => {});
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: a.id } });
    await audit(auth, { action: "attachment.delete", resourceType: "Attachment", resourceId: a.id }, tx);
  });
}
