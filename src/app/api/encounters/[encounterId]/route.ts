import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { encounterUpdateSchema } from "@/lib/validation";
import { getEncounter, updateEncounter } from "@/services/encounters";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ encounterId: string }> };

// GET /api/encounters/:encounterId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { encounterId } = await params;
  const encounter = await getEncounter(auth, encounterId);
  return json({ encounter });
});

// PATCH /api/encounters/:encounterId
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { encounterId } = await params;
  const data = encounterUpdateSchema.parse(await req.json());
  const encounter = await updateEncounter(auth, encounterId, data);
  return json({ encounter });
});
