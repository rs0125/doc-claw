import { authenticate, type AuthContext } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { ApiError, handle, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { patientUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ patientId: string }> };

async function getOwnedPatient(auth: AuthContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: auth.doctor.id },
  });
  if (!patient) throw new ApiError(404, "Patient not found");
  return patient;
}

// GET /api/patients/:patientId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const patient = await getOwnedPatient(auth, patientId);

  auditRead(auth, { action: "patient.read", resourceType: "Patient", resourceId: patient.id });

  return json({ patient });
});

// PATCH /api/patients/:patientId
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  await getOwnedPatient(auth, patientId);

  const data = patientUpdateSchema.parse(await req.json());
  if (Object.keys(data).length === 0) throw new ApiError(400, "Empty update");

  const patient = await prisma.$transaction(async (tx) => {
    const updated = await tx.patient.update({ where: { id: patientId }, data });
    await audit(
      auth,
      {
        action: "patient.update",
        resourceType: "Patient",
        resourceId: patientId,
        details: { changedFields: Object.keys(data) },
      },
      tx,
    );
    return updated;
  });

  return json({ patient });
});
