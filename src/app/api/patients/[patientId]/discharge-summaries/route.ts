import { authenticate } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError, handle, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { summaryCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ patientId: string }> };

// GET /api/patients/:patientId/discharge-summaries
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: auth.doctor.id },
    select: { id: true },
  });
  if (!patient) throw new ApiError(404, "Patient not found");

  const summaries = await prisma.dischargeSummary.findMany({
    where: { patientId, doctorId: auth.doctor.id },
    orderBy: { dischargeDate: "desc" },
  });

  auditRead(auth, {
    action: "summary.list",
    resourceType: "DischargeSummary",
    details: { patientId, results: summaries.length },
  });

  return json({ summaries });
});

// POST /api/patients/:patientId/discharge-summaries
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: auth.doctor.id },
    select: { id: true },
  });
  if (!patient) throw new ApiError(404, "Patient not found");

  const data = summaryCreateSchema.parse(await req.json());
  if (data.dischargeDate < data.admissionDate) {
    throw new ApiError(400, "dischargeDate cannot be before admissionDate");
  }

  const summary = await prisma.$transaction(async (tx) => {
    const created = await tx.dischargeSummary.create({
      data: { ...data, patientId, doctorId: auth.doctor.id },
    });
    await audit(
      auth,
      {
        action: "summary.create",
        resourceType: "DischargeSummary",
        resourceId: created.id,
        details: { patientId },
      },
      tx,
    );
    return created;
  });

  return json({ summary }, 201);
});
