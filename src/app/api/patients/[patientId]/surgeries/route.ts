import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { surgeryCreateSchema } from "@/lib/validation";
import { createSurgery, listSurgeries } from "@/services/surgeries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ patientId: string }> };

// GET /api/patients/:patientId/surgeries
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const surgeries = await listSurgeries(auth, patientId);
  return json({ surgeries });
});

// POST /api/patients/:patientId/surgeries (supports Idempotency-Key)
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const data = surgeryCreateSchema.parse(await req.json());

  return withIdempotency(auth, req, async () => {
    const surgery = await createSurgery(auth, patientId, data);
    return { status: 201, body: { surgery: JSON.parse(JSON.stringify(surgery)) } };
  });
});
