import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { encounterCreateSchema } from "@/lib/validation";
import { createEncounter, listEncounters } from "@/services/encounters";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ patientId: string }> };

// GET /api/patients/:patientId/encounters
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const encounters = await listEncounters(auth, patientId);
  return json({ encounters });
});

// POST /api/patients/:patientId/encounters (supports Idempotency-Key)
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const data = encounterCreateSchema.parse(await req.json());

  return withIdempotency(auth, req, async () => {
    const encounter = await createEncounter(auth, patientId, data);
    return { status: 201, body: { encounter: JSON.parse(JSON.stringify(encounter)) } };
  });
});
