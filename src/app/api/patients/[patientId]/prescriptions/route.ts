import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { prescriptionCreateSchema } from "@/lib/validation";
import { createPrescription, listPrescriptions } from "@/services/prescriptions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ patientId: string }> };

// GET /api/patients/:patientId/prescriptions
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const prescriptions = await listPrescriptions(auth, patientId);
  return json({ prescriptions });
});

// POST /api/patients/:patientId/prescriptions (supports Idempotency-Key)
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const data = prescriptionCreateSchema.parse(await req.json());

  return withIdempotency(auth, req, async () => {
    const prescription = await createPrescription(auth, patientId, data);
    return { status: 201, body: { prescription: JSON.parse(JSON.stringify(prescription)) } };
  });
});
