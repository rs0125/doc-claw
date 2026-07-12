import { authenticate } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ApiError, handle, json } from "@/lib/http";
import { renderDischargeSummaryPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";
import { putObject, signedGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ summaryId: string }> };

// GET /api/discharge-summaries/:summaryId/document
// Renders the PDF to R2 (if missing or stale) and returns a short-lived signed URL.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { summaryId } = await params;

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

  return json({ url, expiresInSeconds });
});
