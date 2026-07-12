import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { listQuerySchema, patientCreateSchema } from "@/lib/validation";
import { searchPatients, createPatient } from "@/services/patients";

export const dynamic = "force-dynamic";

// GET /api/patients?q=<name or phone>&limit=&offset=
export const GET = handle(async (req: Request) => {
  const auth = await authenticate(req);
  const { searchParams } = new URL(req.url);
  const { q, limit, offset } = listQuerySchema.parse(Object.fromEntries(searchParams));

  const { patients, total } = await searchPatients(auth, { q, limit, offset });
  return json({ patients, total, limit, offset });
});

// POST /api/patients (supports Idempotency-Key)
export const POST = handle(async (req: Request) => {
  const auth = await authenticate(req);
  const data = patientCreateSchema.parse(await req.json());

  return withIdempotency(auth, req, async () => {
    const patient = await createPatient(auth, data);
    return { status: 201, body: { patient: JSON.parse(JSON.stringify(patient)) } };
  });
});
