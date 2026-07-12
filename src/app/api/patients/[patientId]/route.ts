import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { patientUpdateSchema } from "@/lib/validation";
import { getPatient, updatePatient } from "@/services/patients";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ patientId: string }> };

// GET /api/patients/:patientId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const patient = await getPatient(auth, patientId);
  return json({ patient });
});

// PATCH /api/patients/:patientId
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { patientId } = await params;
  const data = patientUpdateSchema.parse(await req.json());
  const patient = await updatePatient(auth, patientId, data);
  return json({ patient });
});
