import { authenticate, type AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError, handle, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { summaryUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ summaryId: string }> };

async function getOwnedSummary(auth: AuthContext, summaryId: string) {
  const summary = await prisma.dischargeSummary.findFirst({
    where: { id: summaryId, doctorId: auth.doctor.id },
  });
  if (!summary) throw new ApiError(404, "Discharge summary not found");
  return summary;
}

// GET /api/discharge-summaries/:summaryId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { summaryId } = await params;
  const summary = await getOwnedSummary(auth, summaryId);

  auditRead(auth, {
    action: "summary.read",
    resourceType: "DischargeSummary",
    resourceId: summary.id,
  });

  return json({ summary });
});

// PATCH /api/discharge-summaries/:summaryId — edit fields and/or finalize (status: FINAL)
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { summaryId } = await params;
  const existing = await getOwnedSummary(auth, summaryId);

  if (existing.status === "FINAL") {
    throw new ApiError(409, "Summary is finalized and can no longer be edited");
  }

  const data = summaryUpdateSchema.parse(await req.json());
  if (Object.keys(data).length === 0) throw new ApiError(400, "Empty update");

  const summary = await prisma.$transaction(async (tx) => {
    const updated = await tx.dischargeSummary.update({
      where: { id: summaryId },
      data,
    });
    await audit(
      auth,
      {
        action: data.status === "FINAL" ? "summary.finalize" : "summary.update",
        resourceType: "DischargeSummary",
        resourceId: summaryId,
        details: { changedFields: Object.keys(data) },
      },
      tx,
    );
    return updated;
  });

  return json({ summary });
});
